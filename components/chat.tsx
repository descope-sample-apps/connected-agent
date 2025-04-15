"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useChat, Message as AIMessage } from "ai/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send } from "lucide-react";
import InChatConnectionPrompt from "@/components/in-chat-connection-prompt";
import { useConnectionNotification } from "@/hooks/use-connection-notification";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import ActionCard from "@/components/action-card";
import { useToast } from "@/components/ui/use-toast";
import { trackPrompt } from "@/lib/analytics";
import { useAuth } from "@/context/auth-context";

// Define message types
interface UIElement {
  type: string;
  service: string;
  message: string;
  connectButton: {
    text: string;
    action: string;
  };
  alternativeMessage?: string;
  requiredScopes?: string[];
  currentScopes?: string[];
}

// Extend the AIMessage type for our custom properties
interface ExtendedMessage extends AIMessage {
  ui?: UIElement;
  parts?: any[];
  toolActions?: any[];
  actionCard?: {
    type: string;
    data: any;
  };
  chatId?: string;
}

interface ChatProps {
  id?: string;
  initialMessages?: AIMessage[];
  selectedChatModel?: string;
  selectedVisibilityType?: string;
  isReadonly?: boolean;
  onNewChat?: () => void;
}

export default function Chat({
  id,
  initialMessages = [],
  selectedChatModel = DEFAULT_CHAT_MODEL,
  selectedVisibilityType = "private",
  isReadonly = false,
  onNewChat,
}: ChatProps) {
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit: chatHandleSubmit,
    isLoading: isChatLoading,
    error,
  } = useChat({
    api: "/api/chat",
    body: {
      id,
      selectedChatModel,
    },
    initialMessages,
    onResponse: async (response) => {
      // Check for errors in the response
      if (response.status === 429) {
        toast({
          title: "Service Temporarily Unavailable",
          description:
            "We've received too many requests recently. Descope outbound apps is currently experiencing high usage, please try again later.",
          variant: "destructive",
        });
        return;
      }

      // Check for authentication errors
      if (response.status === 401) {
        toast({
          title: "Authentication Error",
          description: "Your session has expired. Please log in again.",
          variant: "destructive",
        });
        return;
      }

      // Check for OAuth-related errors
      if (response.status === 403) {
        try {
          const errorData = await response.json();
          if (errorData?.error === "insufficient_scopes") {
            // The error response will be handled by the UI element in the message
            return;
          }
        } catch (error) {
          console.error("Error parsing error response:", error);
        }
      }

      // Ensure we scroll to bottom when new content arrives
      scrollToBottom();
    },
    onFinish: (message) => {
      setIsLoading(false);
      // Final scroll to bottom after completion
      scrollToBottom();

      // Track prompt completion in analytics
      trackPrompt("prompt_completed", {
        chatId: id,
        modelName: selectedChatModel,
        success: true,
        responseTime: Date.now() - (promptStartTime || Date.now()),
      });

      // Also track directly with Segment for consistency
      if (
        typeof window !== "undefined" &&
        window.analytics &&
        typeof window.analytics.track === "function"
      ) {
        window.analytics.track("prompt_completed", {
          chatId: id,
          modelName: selectedChatModel,
          success: true,
          responseTime: Date.now() - (promptStartTime || Date.now()),
          timestamp: new Date().toISOString(),
        });
      }
    },
    onError: (error) => {
      console.error("Streaming error:", error);
      setIsLoading(false);

      // Track prompt error in analytics
      trackPrompt("prompt_completed", {
        chatId: id,
        modelName: selectedChatModel,
        success: false,
        responseTime: Date.now() - (promptStartTime || Date.now()),
      });

      // Also track directly with Segment for consistency
      if (
        typeof window !== "undefined" &&
        window.analytics &&
        typeof window.analytics.track === "function"
      ) {
        window.analytics.track("prompt_completed", {
          chatId: id,
          modelName: selectedChatModel,
          success: false,
          errorMessage: error.message || "Unknown error",
          responseTime: Date.now() - (promptStartTime || Date.now()),
          timestamp: new Date().toISOString(),
        });
      }

      // Check for authentication errors
      if (error.message && error.message.includes("Unauthorized")) {
        toast({
          title: "Authentication Error",
          description: "Your session has expired. Please log in again.",
          variant: "destructive",
        });
        return;
      }

      // Check for rate limiting errors
      if (
        error.message &&
        (error.message.includes("429") ||
          error.message.includes("Too Many Requests") ||
          error.message.includes("rate limit"))
      ) {
        toast({
          title: "Service Temporarily Unavailable",
          description:
            "We've received too many requests recently. Descope outbound apps is currently experiencing high usage, please try again later.",
          variant: "destructive",
        });
        return;
      }

      // Check for OAuth-related errors
      if (
        error.message &&
        (error.message.includes("insufficient_scopes") ||
          error.message.includes("connection_required") ||
          error.message.includes("403"))
      ) {
        // The error response will be handled by the UI element in the message
        return;
      }

      toast({
        title: "Error",
        description: "Failed to get response from AI. Please try again.",
        variant: "destructive",
      });
    },
  });

  const { toast } = useToast();
  const { user } = useAuth();
  const [usage, setUsage] = useState<{
    messageCount: number;
    monthlyLimit: number;
  } | null>(null);

  // Track when prompt started for timing
  const [promptStartTime, setPromptStartTime] = useState<number | null>(null);

  // Messages that have action cards to display
  const [messagesWithActions, setMessagesWithActions] = useState<string[]>([]);

  // Reference to scroll to the bottom of messages
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Get the last message for connection detection
  const lastMessage =
    messages.length > 0 ? messages[messages.length - 1] : null;

  // Filter out empty messages
  const filteredMessages = useMemo(() => {
    return messages.filter((message) => {
      // Skip empty messages
      if (!message.content && (!message.parts || message.parts.length === 0)) {
        return false;
      }
      return true;
    });
  }, [messages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [filteredMessages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Use our custom hook to detect connection needs
  const { provider, isNeeded, hideNotification, checkConnections } =
    useConnectionNotification({
      message: lastMessage?.role === "assistant" ? lastMessage.content : "",
      isLLMResponse: lastMessage?.role === "assistant",
      onConnectionSucceeded: () => {
        // Resend the last user message to get a complete response after connection
        const lastUserMessage = [...messages]
          .reverse()
          .find((m) => m.role === "user");
        if (lastUserMessage) {
          console.log(
            "Connection successful, could resend:",
            lastUserMessage.content
          );
        }
      },
    });

  // Listen for connection success events
  useEffect(() => {
    const handleConnectionSuccess = (event: CustomEvent) => {
      console.log("Connection success event received:", event.detail);

      // Resend the last user message to get a complete response after connection
      const lastUserMessage = [...messages]
        .reverse()
        .find((m) => m.role === "user");

      if (lastUserMessage) {
        console.log(
          "Connection successful, resending message:",
          lastUserMessage.content
        );
        // You could either submit the message again or reload the chat
        // For simplicity, we'll do a very mild reload that preserves the current chat
        if (id) {
          // Optional: Show a loading state
          setIsLoading(true);

          // Check connections to refresh state
          checkConnections().then(() => {
            // Hide any connection prompts
            hideNotification();

            // Reset loading state
            setIsLoading(false);
          });
        }
      }
    };

    // Add event listener
    window.addEventListener(
      "connection-success",
      handleConnectionSuccess as EventListener
    );

    // Cleanup
    return () => {
      window.removeEventListener(
        "connection-success",
        handleConnectionSuccess as EventListener
      );
    };
  }, [messages, id, hideNotification, checkConnections]);

  // Process message content to look for action triggers
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === "assistant" && lastMessage.content) {
      const content = lastMessage.content.toLowerCase();

      // Check for connection requirements in the text using multiple patterns
      if (
        // Look for common connection phrases
        ((content.includes("connect") &&
          (content.includes("calendar") ||
            content.includes("crm") ||
            content.includes("service"))) ||
          // Look for markdown link patterns related to connections
          (content.includes("connect") && content.includes("](connection:")) ||
          // Look for phrases about needing access
          (content.includes("need") &&
            (content.includes("access") || content.includes("connect")))) &&
        !messagesWithActions.includes(lastMessage.id)
      ) {
        console.log(
          "Detected connection requirement in message:",
          lastMessage.id
        );
        setMessagesWithActions((prev) => [...prev, lastMessage.id]);

        // Automatically scroll to the bottom when connection prompt appears
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      }
    }
  }, [messages, messagesWithActions]);

  // Fetch usage information
  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const response = await fetch("/api/usage");
        const data = await response.json();
        if (data.usage) {
          setUsage(data.usage);
        }
      } catch (error) {
        console.error("Error fetching usage:", error);
      }
    };
    fetchUsage();
  }, []);

  // Function to render a connection prompt if needed
  const renderConnectionPrompt = (message: ExtendedMessage) => {
    // Extract connection information from the message
    const content = message.content.toLowerCase();
    let service = "service";

    if (content.includes("crm")) service = "crm";
    if (content.includes("calendar")) service = "google-calendar";
    if (content.includes("docs")) service = "google-docs";
    if (content.includes("meet")) service = "google-meet";

    // Extract the action URL if available
    const actionMatch = message.content.match(
      /\[([^\]]+)\]\(connection:\/\/([^)]+)\)/
    );
    const connectButtonText = actionMatch ? actionMatch[1] : "Connect";
    const connectButtonAction = actionMatch
      ? `connection://${actionMatch[2]}`
      : `connection://${service}`;

    // Check if we have UI element with scope information
    const uiElement = message.ui;
    const requiredScopes = uiElement?.requiredScopes || [];
    const currentScopes = uiElement?.currentScopes || [];

    // Build the message based on whether we have scope information
    let messageText = `To continue, you need to connect your ${service.replace(
      "-",
      " "
    )}.`;
    let alternativeMessage =
      "This will allow the assistant to access the necessary data to fulfill your request.";

    if (requiredScopes.length > 0) {
      messageText = `Additional permissions are required for ${service.replace(
        "-",
        " "
      )}.`;
      alternativeMessage = `The following permissions are needed: ${requiredScopes
        .map((scope) => scope.split("/").pop() || scope)
        .join(", ")}`;
    }

    return (
      <InChatConnectionPrompt
        service={service.replace("-", " ")}
        message={messageText}
        connectButtonText={connectButtonText}
        connectButtonAction={connectButtonAction}
        alternativeMessage={alternativeMessage}
        chatId={id}
        requiredScopes={requiredScopes}
        currentScopes={currentScopes}
      />
    );
  };

  // Render a standard message bubble
  const renderMessage = (message: ExtendedMessage) => {
    // Skip rendering if message content is empty
    if (!message.content && (!message.parts || message.parts.length === 0)) {
      return null;
    }

    // Check if this message has an action card
    const hasActionCard = message.actionCard !== undefined;
    const hasToolActions =
      message.toolActions && message.toolActions.length > 0;
    const showConnectionPrompt =
      message.role === "assistant" &&
      message.content &&
      message.content.toLowerCase().includes("connect") &&
      (message.content.toLowerCase().includes("calendar") ||
        message.content.toLowerCase().includes("crm") ||
        message.content.toLowerCase().includes("service") ||
        message.content.includes("](connection:"));

    // Check what kind of streaming placeholder we have
    const isToolInvocation =
      message.role === "assistant" &&
      message.content &&
      (message.content.includes('{"type":"tool-invocation"}') ||
        message.content.includes('{"type":"function-execution"}') ||
        message.content.includes('"name":"'));

    const isStepStart =
      message.role === "assistant" &&
      message.content &&
      message.content.includes('{"type":"step-start"}');

    console.log("isStepStart", isStepStart);

    const isGeneralStreamingPlaceholder =
      message.role === "assistant" &&
      message.content &&
      !isToolInvocation && // Don't treat tool activity as a placeholder
      !isStepStart && // Don't treat step-start as a general placeholder
      (message.content.includes('{"type":"step-end"}') ||
        (message.content.startsWith("{") &&
          message.content.includes('"type":')));

    // Extract tool name if available
    let toolName = "";
    if (isToolInvocation) {
      try {
        const match = message.content.match(/"name"\s*:\s*"([^"]+)"/);
        if (match && match[1]) {
          toolName = match[1];
        }
      } catch (e) {
        console.error("Error parsing tool name:", e);
      }
    }

    // Format the tool name for display
    const formatToolName = (name: string) => {
      if (!name) return "";
      return name
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (str) => str.toUpperCase())
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/_/g, " ")
        .replace(/get/i, "")
        .replace(/create/i, "")
        .replace(/send/i, "")
        .trim();
    };

    let parsedContent: any = null;
    let toolActivity: any = null;
    if (message.content && typeof message.content === "string") {
      try {
        parsedContent = JSON.parse(message.content);
        if (parsedContent.type === "toolActivity") {
          toolActivity = parsedContent;
        }
      } catch (e) {
        // Not a JSON message, use as is
      }
    }

    return (
      <div
        className={`flex ${
          message.role === "user" ? "justify-end" : "justify-start"
        } mb-4`}
      >
        <div
          className={`max-w-[85%] md:max-w-[75%] rounded-2xl p-4 ${
            message.role === "user"
              ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md"
              : "bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 shadow-sm"
          }`}
        >
          {isToolInvocation ? (
            <div className="flex items-center py-2">
              <div className="tool-execution-indicator mr-3">
                <svg
                  className="animate-spin h-4 w-4 text-indigo-500"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              </div>
              <div className="flex flex-col">
                <div className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                  {toolName
                    ? `Using ${formatToolName(toolName)}...`
                    : "Using tools..."}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  Accessing external data
                </div>
              </div>
            </div>
          ) : isStepStart ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="flex space-x-1">
                <div
                  className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce"
                  style={{ animationDelay: "0ms" }}
                />
                <div
                  className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce"
                  style={{ animationDelay: "150ms" }}
                />
                <div
                  className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce"
                  style={{ animationDelay: "300ms" }}
                />
              </div>
              <span>Processing your request...</span>
            </div>
          ) : isGeneralStreamingPlaceholder ? (
            <div className="flex items-center py-2">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <div className="ml-3 text-sm text-gray-400">Thinking...</div>
            </div>
          ) : (
            <div className="prose prose-sm">{message.content}</div>
          )}

          {/* Render connection prompt if needed */}
          {showConnectionPrompt && renderConnectionPrompt(message)}

          {/* Render action card if present */}
          {hasActionCard && message.actionCard && (
            <div className="mt-4">
              <ActionCard
                title={message.actionCard.data?.title || ""}
                description={message.actionCard.data?.description || ""}
                logo={message.actionCard.data?.logo || ""}
                onClick={() => {}}
              />
            </div>
          )}

          {/* Render UI element if present */}
          {message.ui && (
            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800 shadow-inner">
              <p className="text-gray-700 dark:text-gray-200 mb-3 font-medium">
                {message.ui.message}
              </p>
              <button
                onClick={() => {
                  if (
                    message.ui?.connectButton.action.startsWith("connection://")
                  ) {
                    const service = message.ui.connectButton.action.replace(
                      "connection://",
                      ""
                    );
                    console.log(`Connecting to ${service}...`);
                  }
                }}
                className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-lg shadow-sm transition-colors"
              >
                {message.ui.connectButton.text}
              </button>
              {message.ui.alternativeMessage && (
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-3">
                  {message.ui.alternativeMessage}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Custom submit handler to manage loading state
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    // Set prompt start time for analytics
    setPromptStartTime(Date.now());

    // Track prompt submission in analytics
    trackPrompt("prompt_submitted", {
      userId: user?.id,
      promptText: input.trim(),
      chatId: id,
      modelName: selectedChatModel,
    });

    // Also track directly with Segment for consistency
    if (
      typeof window !== "undefined" &&
      window.analytics &&
      typeof window.analytics.track === "function"
    ) {
      window.analytics.track("prompt_submitted", {
        userId: user?.id,
        promptText: input.trim(),
        chatId: id,
        modelName: selectedChatModel,
        timestamp: new Date().toISOString(),
      });
    }

    setIsLoading(true);
    try {
      await chatHandleSubmit(e);
    } catch (error) {
      console.error("Error submitting message:", error);
      setIsLoading(false);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    // Add CSS for the typing indicator
    const style = document.createElement("style");
    style.innerHTML = `
      .typing-indicator {
        display: flex;
        align-items: center;
      }
      
      .typing-indicator span {
        height: 8px;
        width: 8px;
        margin: 0 2px;
        background-color: #6366f1;
        border-radius: 50%;
        display: inline-block;
        opacity: 0.7;
      }
      
      .typing-indicator span:nth-of-type(1) {
        animation: bounce 1.5s infinite 0.3s;
      }
      
      .typing-indicator span:nth-of-type(2) {
        animation: bounce 1.5s infinite 0.6s;
      }
      
      .typing-indicator span:nth-of-type(3) {
        animation: bounce 1.5s infinite 0.9s;
      }
      
      @keyframes bounce {
        0%, 80%, 100% {
          transform: translateY(0);
        }
        40% {
          transform: translateY(-8px);
        }
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <div className="flex flex-col h-full relative bg-muted/20">
      {/* Usage information */}
      {usage && (
        <div className="px-4 py-2 bg-gray-50 border-b">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>
              Monthly Usage: {usage.messageCount} / {usage.monthlyLimit}{" "}
              messages
            </span>
            {usage.messageCount >= usage.monthlyLimit && (
              <span className="text-red-500 font-medium">
                Monthly limit reached
              </span>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {filteredMessages.length > 0 ? (
          <div className="max-w-4xl mx-auto p-6 pt-10 pb-24">
            {filteredMessages.map((message, index) => (
              <div key={message.id || index}>
                {renderMessage(message as ExtendedMessage)}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-5xl mx-auto w-full">
            <h2 className="text-2xl font-bold mb-2">
              Start a new conversation
            </h2>
            <p className="text-muted-foreground text-center max-w-md mb-8">
              Ask me anything about your CRM data, calendar, or business needs.
            </p>
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 rounded-full flex items-center justify-center mb-4 border border-indigo-100 dark:border-indigo-900/40">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-8 w-8 text-indigo-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </div>
          </div>
        )}
      </div>

      {!isReadonly && (
        <div className="border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <Input
              value={input}
              onChange={handleInputChange}
              placeholder="Type your message..."
              className="flex-1 border-gray-200 dark:border-gray-700 focus-visible:ring-indigo-500"
              disabled={isLoading}
            />
            <Button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
