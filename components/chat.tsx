"use client";

import { useState, useRef, useEffect } from "react";
import { useChat, Message as AIMessage } from "ai/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send } from "lucide-react";
import InChatConnectionPrompt from "@/components/in-chat-connection-prompt";
import { useConnectionNotification } from "@/hooks/use-connection-notification";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import ActionCard from "@/components/action-card";

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
  } = useChat({
    api: "/api/chat",
    body: {
      id,
      selectedChatModel,
    },
    initialMessages,
  });

  // Messages that have action cards to display
  const [messagesWithActions, setMessagesWithActions] = useState<string[]>([]);

  // Reference to scroll to the bottom of messages
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Get the last message for connection detection
  const lastMessage =
    messages.length > 0 ? messages[messages.length - 1] : null;

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

  // Function to render a connection prompt if needed
  const renderConnectionPrompt = (message: ExtendedMessage) => {
    // Extract connection information from the message
    const content = message.content.toLowerCase();
    let service = "service";

    if (content.includes("crm")) service = "crm";
    if (content.includes("calendar")) service = "google-calendar";
    if (content.includes("docs")) service = "google-docs";

    // Extract the action URL if available
    const actionMatch = message.content.match(
      /\[([^\]]+)\]\(connection:\/\/([^)]+)\)/
    );
    const connectButtonText = actionMatch ? actionMatch[1] : "Connect";
    const connectButtonAction = actionMatch
      ? `connection://${actionMatch[2]}`
      : `connection://${service}`;

    return (
      <InChatConnectionPrompt
        service={service.replace("-", " ")}
        message={`To continue, you need to connect your ${service.replace(
          "-",
          " "
        )}.`}
        connectButtonText={connectButtonText}
        connectButtonAction={connectButtonAction}
        alternativeMessage="This will allow the assistant to access the necessary data to fulfill your request."
        chatId={id}
      />
    );
  };

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

  // Render a standard message bubble
  const renderMessage = (message: ExtendedMessage) => {
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
          <div className="prose prose-sm">{message.content}</div>

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

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    chatHandleSubmit(e);
  };

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 p-4 md:p-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 py-12">
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
            <h3 className="text-xl font-semibold bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent mb-2">
              Start a New Conversation
            </h3>
            <p className="text-muted-foreground max-w-md mb-6">
              Ask a question or type a message to begin chatting with
              ConnectedAgent.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message, index) => (
              <div key={index}>{renderMessage(message as ExtendedMessage)}</div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

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
