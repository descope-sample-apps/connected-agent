"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useChat, Message as AIMessage } from "ai/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Loader2 } from "lucide-react";
import InChatConnectionPrompt from "@/components/in-chat-connection-prompt";
import { useConnectionNotification } from "@/hooks/use-connection-notification";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import ActionCard from "@/components/action-card";
import { useToast } from "@/components/ui/use-toast";
import { trackPrompt } from "@/lib/analytics";
import { useAuth } from "@/context/auth-context";
import { OAuthProvider } from "@/lib/tools/base";
import { connectToOAuthProvider, handleOAuthPopup } from "@/lib/oauth-utils";

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
  // Process initialMessages to ensure proper format
  const processedInitialMessages = useMemo(() => {
    return initialMessages.map((msg: ExtendedMessage) => {
      // If the message has parts, ensure content is properly derived from them
      if (msg.parts && msg.parts.length > 0) {
        // Extract text content from parts to avoid showing raw JSON in the UI
        const textContent = msg.parts
          .map((part) => {
            if (typeof part === "object" && part.type === "text") {
              return part.text || "";
            }
            return "";
          })
          .filter(Boolean)
          .join("\n");

        return {
          ...msg,
          content: textContent || msg.content,
          id: msg.id ? `db-${msg.id}` : msg.id, // Mark as coming from database
        };
      }
      return {
        ...msg,
        id: msg.id ? `db-${msg.id}` : msg.id, // Mark all initial messages as from database
      };
    });
  }, [initialMessages]);

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
    initialMessages: processedInitialMessages,
    id: id || undefined, // Use id as key to reset chat when id changes
    onResponse: async (response) => {
      // Check for errors in the response
      if (response.status === 429) {
        try {
          const errorData = await response.json();

          // Check if this is a monthly usage limit exceeded error
          if (errorData?.error?.includes("Monthly usage limit exceeded")) {
            toast({
              title: "Monthly Usage Limit Reached",
              description:
                errorData?.message ||
                "You've reached your monthly usage limit for this service. Please check your subscription or try again next month.",
              variant: "destructive",
            });
          } else {
            // Generic rate limit message for other 429 errors
            toast({
              title: "Service Temporarily Unavailable",
              description:
                "We've received too many requests recently. Please try again later.",
              variant: "destructive",
            });
          }
        } catch (error) {
          // If we can't parse the response, use a generic message
          toast({
            title: "Rate Limit Exceeded",
            description:
              "The service is experiencing high demand. Please try again later.",
            variant: "destructive",
          });
        }
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

      // Check for stream parsing errors
      if (error.message && error.message.includes("Failed to parse stream")) {
        console.warn("Stream parsing error detected:", error.message);

        // If it's a parsing error related to connection_required, don't show an error toast
        if (
          error.message.includes("connection_required") ||
          error.message.includes('"type"') ||
          error.message.includes("Google Docs")
        ) {
          console.log(
            "Connection requirement detected in failed stream, not showing error toast"
          );
          return;
        }
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
          error.message.includes("rate limit") ||
          error.message.includes("Rate limit") ||
          error.message.includes("ratelimit"))
      ) {
        // Determine if this is a monthly limit or general rate limit
        const isMonthlyLimit = error.message.includes("Monthly usage limit");

        toast({
          title: isMonthlyLimit
            ? "Monthly Usage Limit Reached"
            : "Rate Limit Exceeded",
          description: isMonthlyLimit
            ? "You've reached your monthly usage limit for this service. Please check your subscription or try again next month."
            : "The service is currently experiencing high demand. Please try again in a few moments.",
          variant: "destructive",
        });
        return;
      }

      // Try to parse the error message as JSON if it's in that format
      try {
        if (
          error.message &&
          (error.message.includes('{"error"') ||
            error.message.includes('{"message"'))
        ) {
          // Extract the JSON part from the error message
          let jsonStr = error.message;

          // Find the first { and last } to extract JSON
          const startIndex = jsonStr.indexOf("{");
          const endIndex = jsonStr.lastIndexOf("}") + 1;

          if (startIndex >= 0 && endIndex > startIndex) {
            jsonStr = jsonStr.substring(startIndex, endIndex);

            const errorObject = JSON.parse(jsonStr);

            // Extract status code if present
            const statusCode =
              errorObject.status ||
              (errorObject.error && errorObject.error.status);
            const isRateLimit =
              statusCode === 429 ||
              (errorObject.error &&
                (errorObject.error.includes("rate limit") ||
                  errorObject.error.includes("Rate limit") ||
                  errorObject.error.includes("429")));

            // Handle rate limit errors specifically
            if (isRateLimit) {
              const isMonthlyLimit =
                (errorObject.error &&
                  errorObject.error.includes("Monthly usage limit")) ||
                (errorObject.message &&
                  errorObject.message.includes("Monthly usage limit"));

              toast({
                title: isMonthlyLimit
                  ? "Monthly Usage Limit Reached"
                  : "Rate Limit Exceeded",
                description:
                  errorObject.message ||
                  (isMonthlyLimit
                    ? "You've reached your monthly usage limit for this service."
                    : "The service is currently experiencing high demand. Please try again in a few moments."),
                variant: "destructive",
              });
              return;
            }

            // For other error types
            if (errorObject.error || errorObject.message) {
              toast({
                title: "Service Error",
                description: errorObject.message || errorObject.error,
                variant: "destructive",
              });
              return;
            }
          }
        }
      } catch (parseError) {
        // Parsing failed, continue to default error handling
        console.error("Error parsing error message:", parseError);
      }

      // Default error toast
      toast({
        title: "Error",
        description:
          "An error occurred while processing your request. Please try again.",
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
    return messages
      .filter((message) => {
        // Skip empty messages
        if (
          !message.content &&
          (!message.parts || message.parts.length === 0)
        ) {
          return false;
        }
        return true;
      })
      .map((message: ExtendedMessage) => {
        // For messages with parts but no content, extract content from parts
        if (
          (!message.content || message.content === "") &&
          message.parts &&
          message.parts.length > 0
        ) {
          // Extract text content from parts to create proper content field
          const textContent = message.parts
            .map((part) => {
              if (typeof part === "object" && part.type === "text") {
                return part.text || "";
              }
              return "";
            })
            .filter(Boolean)
            .join("\n");

          return {
            ...message,
            content: textContent || message.content,
          };
        }
        return message;
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

  // Function to mark the last successful connection time in localStorage
  const markServiceConnected = (service: string) => {
    if (typeof window !== "undefined") {
      const timestamp = Date.now();
      localStorage.setItem(`last_connection_${service}`, timestamp.toString());
      console.log(
        `Marked ${service} as connected at ${new Date(timestamp).toISOString()}`
      );
    }
  };

  // Function to check if a service was recently connected
  const wasRecentlyConnected = (service: string, maxAgeMs: number = 30000) => {
    if (typeof window === "undefined") return false;

    const lastConnectionTime = localStorage.getItem(
      `last_connection_${service}`
    );
    if (!lastConnectionTime) return false;

    const timestamp = parseInt(lastConnectionTime, 10);
    const now = Date.now();
    return now - timestamp < maxAgeMs;
  };

  // Listen for connection success events
  useEffect(() => {
    const handleConnectionSuccess = (event: CustomEvent) => {
      console.log("Connection success event received:", event.detail);

      // Mark this service as connected in localStorage
      if (event.detail && event.detail.service) {
        markServiceConnected(event.detail.service);
      }

      // See if we should retry immediately (set from UI button)
      const retryImmediately = event.detail?.retryImmediately === true;

      // Resend the last user message to get a complete response after connection
      const lastUserMessage = [...messages]
        .reverse()
        .find((m) => m.role === "user");

      if (lastUserMessage) {
        console.log(
          "Connection successful, resending message:",
          lastUserMessage.content
        );

        // Set a loading state to indicate we're retrying
        setIsLoading(true);

        // Hide any connection prompts
        hideNotification();

        // Check connections to refresh state
        checkConnections().then(() => {
          // For button-triggered reconnects, use a shorter delay
          const delayTime = retryImmediately ? 100 : 1000;

          // Introduce a small delay to ensure the connection state is updated
          setTimeout(() => {
            // Get the message we want to resend
            const messageToResend = lastUserMessage.content;

            // Set the input value first (for UI consistency)
            handleInputChange({
              target: { value: messageToResend },
            } as React.ChangeEvent<HTMLInputElement>);

            // Then manually trigger the submit with a proper event object
            const event = {
              preventDefault: () => {},
            } as React.FormEvent<HTMLFormElement>;
            chatHandleSubmit(event);

            // Reset loading state after submission
            setTimeout(() => {
              setIsLoading(false);
            }, 100);
          }, delayTime);
        });
      } else {
        // If no message to resend, just refresh the connection state
        setIsLoading(true);
        checkConnections().then(() => {
          hideNotification();
          setIsLoading(false);
        });
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

  // Function to enhance connection details for Google Drive
  const getEnhancedGoogleDocsConnectionDetails = () => {
    return {
      text: "Connect Google Docs & Drive",
      message:
        "Google Docs & Drive access is required to create and save documents.",
      alternativeMessage:
        "This will allow the assistant to create and edit documents and store them on your Google Drive.",
      requiredScopes: [
        "https://www.googleapis.com/auth/documents",
        "https://www.googleapis.com/auth/drive",
        "https://www.googleapis.com/auth/drive.file",
      ],
    };
  };

  // Function to render a connection prompt if needed
  const renderConnectionPrompt = (message: ExtendedMessage) => {
    let service: OAuthProvider = "google-calendar"; // Default
    let requiredScopes: string[] = [];
    let isReconnect = false;
    let customMessage = "";

    // 1. First check if message has structured UI element (preferred source)
    if (message.ui) {
      // Use the structured UI data if available
      service = message.ui.service as OAuthProvider;
      requiredScopes = message.ui.requiredScopes || [];
      customMessage = message.ui.message;

      // If message has requiredScopes, it's likely a reconnect flow
      isReconnect = requiredScopes.length > 0;

      return (
        <InChatConnectionPrompt
          service={service.replace("-", " ")}
          message={customMessage}
          connectButtonText={message.ui.connectButton.text}
          connectButtonAction={message.ui.connectButton.action}
          alternativeMessage={message.ui.alternativeMessage || ""}
          chatId={id}
          requiredScopes={requiredScopes}
          currentScopes={message.ui.currentScopes || []}
        />
      );
    }

    // 2. Otherwise, extract from content as fallback
    // Extract connection information from the message content
    const content = message.content.toLowerCase();

    // Determine the service type from content
    if (content.includes("crm")) service = "custom-crm";
    if (content.includes("calendar")) service = "google-calendar";
    if (content.includes("docs")) service = "google-docs";
    if (content.includes("meet")) service = "google-meet";
    if (content.includes("slack")) service = "slack";
    if (content.includes("zoom")) service = "zoom";

    // Check if it's likely a reconnect message
    isReconnect =
      content.includes("additional permission") ||
      content.includes("more permission") ||
      content.includes("reconnect");

    // Extract the action URL if available
    const actionMatch = message.content.match(
      /\[([^\]]+)\]\(connection:\/\/([^)]+)\)/
    );
    let connectButtonText = actionMatch
      ? actionMatch[1]
      : `Connect ${getDisplayName(service)}`;
    const connectButtonAction = actionMatch
      ? `connection://${actionMatch[2]}`
      : `connection://${service}`;

    // Handle specific scopes for different services
    if (service === "google-docs") {
      // Check if the error specifically mentions Drive
      const isDriveError = content.includes("drive");

      if (isDriveError) {
        // Use enhanced details for Google Drive
        const enhancedDetails = getEnhancedGoogleDocsConnectionDetails();
        connectButtonText = enhancedDetails.text;
        requiredScopes = enhancedDetails.requiredScopes;

        // Build the message based on whether it seems to be a reconnect
        let messageText = isReconnect
          ? `Additional permissions are required for Google Docs & Drive.`
          : enhancedDetails.message;

        let alternativeMessage = enhancedDetails.alternativeMessage;

        return (
          <InChatConnectionPrompt
            service="Google Docs & Drive"
            message={messageText}
            connectButtonText={connectButtonText}
            connectButtonAction={connectButtonAction}
            alternativeMessage={alternativeMessage}
            chatId={id}
            requiredScopes={requiredScopes}
            currentScopes={[]}
          />
        );
      } else {
        requiredScopes.push("https://www.googleapis.com/auth/documents");
      }
    } else if (service === "google-calendar") {
      requiredScopes.push("https://www.googleapis.com/auth/calendar");
    } else if (service === "google-meet") {
      requiredScopes.push(
        "https://www.googleapis.com/auth/calendar",
        "https://www.googleapis.com/auth/meetings.space.created"
      );
    }

    // Build the message based on whether it seems to be a reconnect
    let messageText = isReconnect
      ? `Additional permissions are required for ${getDisplayName(service)}.`
      : `To continue, you need to connect your ${getDisplayName(service)}.`;

    let alternativeMessage = isReconnect
      ? `The following permissions are needed: ${requiredScopes
          .map((scope) => scope.split("/").pop() || scope)
          .join(", ")}`
      : "This will allow the assistant to access the necessary data to fulfill your request.";

    return (
      <InChatConnectionPrompt
        service={getDisplayName(service)}
        message={messageText}
        connectButtonText={connectButtonText}
        connectButtonAction={connectButtonAction}
        alternativeMessage={alternativeMessage}
        chatId={id}
        requiredScopes={requiredScopes}
        currentScopes={[]}
      />
    );
  };

  // Helper to format provider display names consistently
  const getDisplayName = (provider: string): string => {
    switch (provider) {
      case "google-calendar":
        return "Google Calendar";
      case "google-docs":
        return "Google Docs";
      case "google-meet":
        return "Google Meet";
      case "custom-crm":
        return "CRM";
      case "slack":
        return "Slack";
      case "zoom":
        return "Zoom";
      default:
        return provider.replace(/-/g, " ");
    }
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

    // Try to detect embedded connection UI in the message content
    let connectionUI = null;
    if (message.role === "assistant") {
      try {
        // First check for UI elements in tool responses
        if (message.toolActions && message.toolActions.length > 0) {
          for (const action of message.toolActions) {
            if (action.output?.ui?.type === "connection_required") {
              // Extract the UI element
              connectionUI = action.output.ui;
              break;
            }
          }
        }

        // Process errors that mention Google Drive specifically
        if (!connectionUI && message.content) {
          // Check for Google Drive specific errors
          if (
            message.content.toLowerCase().includes("drive") &&
            (message.content.toLowerCase().includes("scope") ||
              message.content.toLowerCase().includes("permission") ||
              message.content.toLowerCase().includes("access"))
          ) {
            // Create a UI element for Google Drive error
            message = {
              ...message,
              ui: {
                type: "connection_required",
                service: "google-docs",
                message:
                  "Google Docs & Drive access is required to create documents.",
                connectButton: {
                  text: "Connect Google Docs & Drive",
                  action: "connection://google-docs",
                },
                alternativeMessage:
                  "This will allow the assistant to create and manage documents on your behalf.",
                requiredScopes: [
                  "https://www.googleapis.com/auth/documents",
                  "https://www.googleapis.com/auth/drive",
                  "https://www.googleapis.com/auth/drive.file",
                ],
              },
            };
          }
        }

        // Then check for simple connection text pattern if no UI element found
        if (!connectionUI && message.content) {
          const simpleConnectionRegex = /Connection to ([\w-]+) required/i;
          const simpleMatch = message.content.match(simpleConnectionRegex);

          if (simpleMatch && simpleMatch[1]) {
            // Create a UI element from the simple text
            const serviceName = simpleMatch[1].toLowerCase();
            let service: OAuthProvider = "google-docs";

            // Map the service name
            if (serviceName.includes("calendar")) service = "google-calendar";
            else if (serviceName.includes("meet")) service = "google-meet";
            else if (serviceName.includes("crm")) service = "custom-crm";
            else if (serviceName.includes("slack")) service = "slack";
            else if (serviceName.includes("zoom")) service = "zoom";

            // Attach a UI element to the message
            message = {
              ...message,
              ui: {
                type: "connection_required",
                service: service,
                message: `Please connect your ${getDisplayName(
                  service
                )} to continue.`,
                connectButton: {
                  text: `Connect ${getDisplayName(service)}`,
                  action: `connection://${service}`,
                },
                alternativeMessage:
                  "This will allow the assistant to access the necessary data.",
                requiredScopes:
                  service === "google-docs"
                    ? ["https://www.googleapis.com/auth/documents"]
                    : [],
              },
            };
          }
        }

        // Finally try the more complex JSON format if still no UI found
        if (!connectionUI && !message.ui && message.content) {
          const connectionUIRegex = /\{\"type\":\"connection_ui\"[^}]+\}/;
          const match = message.content.match(connectionUIRegex);
          if (match) {
            connectionUI = JSON.parse(match[0]);
            // If we found valid UI, pass it to the message
            if (connectionUI) {
              message = {
                ...message,
                ui: {
                  type: "connection_required",
                  service: connectionUI.service,
                  message: connectionUI.message,
                  connectButton: connectionUI.connectButton,
                  alternativeMessage: connectionUI.alternativeMessage,
                  requiredScopes: connectionUI.requiredScopes || [],
                },
              };
            }
          }
        }
      } catch (e) {
        // Ignore parse errors
        console.log("Error parsing embedded connection UI:", e);
      }
    }

    const showConnectionPrompt =
      message.role === "assistant" &&
      (message.ui?.type === "connection_required" || // Structured UI
        (message.content &&
          ((message.content.toLowerCase().includes("connect") &&
            (message.content.toLowerCase().includes("calendar") ||
              message.content.toLowerCase().includes("crm") ||
              message.content.toLowerCase().includes("service") ||
              message.content.toLowerCase().includes("google docs") ||
              message.content.toLowerCase().includes("documents") ||
              message.content.toLowerCase().includes("drive") ||
              message.content.toLowerCase().includes("google meet"))) ||
            message.content.includes("](connection:") ||
            message.content.includes("connection_required") ||
            message.content.includes("Connection to") ||
            message.content.includes("access required") ||
            message.content.includes("permissions") ||
            message.content.includes("authorization") ||
            message.content.includes('type":"connection_ui') ||
            // Check for UI elements in tool responses
            (message.toolActions &&
              message.toolActions.some(
                (action) => action.output?.ui?.type === "connection_required"
              )))));

    // Check what kind of streaming placeholder we have
    const isToolInvocation =
      message.role === "assistant" &&
      message.content &&
      (message.content.includes('{"type":"tool-invocation"}') ||
        message.content.includes('{"type":"function-execution"}') ||
        message.content.includes('"name":"'));

    // When message content is ONLY a step marker, we should hide it entirely
    if (
      message.content &&
      typeof message.content === "string" &&
      message.content.trim().startsWith("{") &&
      message.content.includes('"type"')
    ) {
      try {
        const parsedJson = JSON.parse(message.content.trim());
        if (
          parsedJson &&
          parsedJson.type &&
          (parsedJson.type === "step-end" || parsedJson.type.startsWith("step"))
        ) {
          // This is ONLY a step marker with no other content
          return null;
        }
      } catch (e) {
        // Not valid JSON, continue with normal rendering
      }
    }

    const isGeneralStreamingPlaceholder =
      message.role === "assistant" &&
      message.content &&
      !isToolInvocation && // Don't treat tool activity as a placeholder
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
            <div className="prose prose-sm">
              {message.parts && message.parts.length > 0
                ? // Handle messages that have been loaded from database with parts structure
                  message.parts.map((part, idx) => {
                    if (typeof part === "object" && part.type === "text") {
                      return <div key={idx}>{part.text}</div>;
                    } else if (typeof part === "string") {
                      return <div key={idx}>{part}</div>;
                    } else {
                      return null;
                    }
                  })
                : // Handle messages that come directly from the AI with content as string
                  message.content}
            </div>
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
                onClick={async () => {
                  if (
                    message.ui?.connectButton.action.startsWith("connection://")
                  ) {
                    try {
                      const service = message.ui.connectButton.action.replace(
                        "connection://",
                        ""
                      );
                      console.log(`Connecting to ${service}...`);

                      // Show loading state
                      setIsLoading(true);

                      // Get the redirect URL
                      const redirectUrl = `${window.location.origin}/api/oauth/callback`;

                      // Get auth URL with any required scopes
                      const authUrl = await connectToOAuthProvider({
                        appId: service,
                        redirectUrl,
                        scopes: message.ui.requiredScopes,
                        state: {
                          chatId: id,
                          originalUrl: window.location.href,
                        },
                      });

                      // Open popup for connection
                      await handleOAuthPopup(authUrl, {
                        onSuccess: () => {
                          // Show success toast
                          toast({
                            title: "Connected successfully",
                            description: `Successfully connected to ${message.ui?.service}`,
                          });

                          // Mark the service as connected in localStorage
                          markServiceConnected(service);

                          // Dispatch a custom event that triggers retry of the last message
                          const event = new CustomEvent("connection-success", {
                            detail: {
                              service: service,
                              retryImmediately: true,
                            },
                          });
                          window.dispatchEvent(event);

                          // Reset loading state
                          setIsLoading(false);
                        },
                        onError: (error) => {
                          // Show error toast
                          toast({
                            title: "Connection failed",
                            description:
                              error.message || "Failed to connect to service",
                            variant: "destructive",
                          });

                          // Reset loading state
                          setIsLoading(false);
                        },
                      });
                    } catch (error) {
                      console.error("Error connecting:", error);

                      // Show error toast
                      toast({
                        title: "Connection failed",
                        description:
                          error instanceof Error
                            ? error.message
                            : "Failed to connect to service",
                        variant: "destructive",
                      });

                      // Reset loading state
                      setIsLoading(false);
                    }
                  }
                }}
                className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-lg shadow-sm transition-colors"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Connecting...
                  </div>
                ) : (
                  message.ui.connectButton.text
                )}
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
