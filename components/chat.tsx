"use client";

import { useState, useEffect, useRef } from "react";
import { ExternalLink } from "lucide-react";
import { useChat, Message as AIMessage } from "ai/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MeetingCard } from "@/components/meeting-card";
import InChatConnectionPrompt from "@/components/in-chat-connection-prompt";
import { Calendar, Database } from "lucide-react";
import { ConnectionNotification } from "./connection-notification";
import { useConnectionNotification } from "@/hooks/use-connection-notification";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { convertToUIMessages } from "@/lib/utils";
import { UIMessage } from "ai";
import ActionCard from "@/components/action-card";

// Define tool action result types
interface ToolActionResult {
  success: boolean;
  action: string;
  provider?: string;
  details: any;
  timestamp: string;
  requiresConnection?: boolean;
  connectionType?: string;
  ui?: {
    type: string;
    service?: string;
    message?: string;
    connectButton?: {
      text: string;
      action: string;
    };
    alternativeMessage?: string;
  };
}

interface Message extends AIMessage {
  toolActions?: ToolActionResult[];
  actionCard?: {
    type: string;
    data: any;
  };
}

export default function Chat({
  id,
  initialMessages,
  selectedChatModel = DEFAULT_CHAT_MODEL,
  selectedVisibilityType = "private",
  isReadonly = false,
}: {
  id: string;
  initialMessages: any[];
  selectedChatModel?: string;
  selectedVisibilityType?: string;
  isReadonly?: boolean;
}) {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
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

  // Get the last message for connection detection
  const lastMessage =
    messages.length > 0 ? messages[messages.length - 1] : null;

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
          // We could implement a resend mechanism here
          console.log(
            "Connection successful, could resend:",
            lastUserMessage.content
          );
        }
      },
    });

  // Formats tool action results (for display purposes)
  const formatToolAction = (action: ToolActionResult) => {
    if (!action.success) {
      return `Failed to ${action.action.replace(/_/g, " ")}: ${
        action.details.error
      }`;
    }

    switch (action.action) {
      case "schedule_meeting":
        return `Meeting "${action.details.title}" scheduled${
          action.details.link ? ` ([View Meeting](${action.details.link}))` : ""
        }`;
      case "create_document":
        return `Document "${action.details.title}" created${
          action.details.link
            ? ` ([View Document](${action.details.link}))`
            : ""
        }`;
      case "create_event":
        return `Calendar event "${action.details.title}" created${
          action.details.link ? ` ([View Event](${action.details.link}))` : ""
        }`;
      default:
        return `Action "${action.action}" completed successfully`;
    }
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
        !messagesWithActions.includes(lastMessage.id || "")
      ) {
        console.log(
          "Detected connection requirement in message:",
          lastMessage.id
        );
        setMessagesWithActions((prev) => [...prev, lastMessage.id || ""]);

        // Automatically scroll to the bottom when connection prompt appears
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      }

      // Check if this is a continuation message after reconnection
      if (
        content.includes("i'll continue retrieving the information") &&
        !messagesWithActions.includes(lastMessage.id || "")
      ) {
        console.log("Detected context continuation message:", lastMessage.id);
        // Don't show this message, just wait for the next response
        setMessagesWithActions((prev) => [...prev, lastMessage.id || ""]);
      }
    }
  }, [messages, messagesWithActions]);

  // Function to render a connection prompt if needed
  const renderConnectionPrompt = (message: Message) => {
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
      />
    );
  };

  // Render a standard message bubble
  const renderMessage = (message: Message) => {
    // Check if this message has an action card
    const hasActionCard = message.actionCard !== undefined;
    const hasToolActions =
      message.toolActions && message.toolActions.length > 0;

    return (
      <div
        className={`flex ${
          message.role === "user" ? "justify-end" : "justify-start"
        } mb-4`}
      >
        <div
          className={`max-w-[80%] rounded-lg p-4 ${
            message.role === "user"
              ? "bg-primary text-primary-foreground"
              : "bg-muted"
          }`}
        >
          {message.parts ? (
            message.parts.map((part, index) => {
              if ("text" in part) {
                return <div key={index}>{part.text}</div>;
              }
              return null;
            })
          ) : (
            <div>{message.content || ""}</div>
          )}

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

          {/* Render tool actions if present */}
          {hasToolActions && (
            <div className="mt-4 space-y-2">
              {message.toolActions?.map((action, index) => (
                <div key={index} className="text-sm">
                  <span className="font-semibold">{action.action}:</span>{" "}
                  {action.details?.message || JSON.stringify(action.details)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render the UI
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        <ScrollArea className="h-full">
          <div className="flex flex-col space-y-4 p-4">
            {messages.map((m) => {
              const message = m as Message;
              const isActionMessage = messagesWithActions.includes(
                message.id || ""
              );

              return (
                <div key={message.id || ""}>
                  {renderMessage(message as Message)}
                </div>
              );
            })}
            {/* Reference for auto-scrolling */}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </div>

      <div className="p-4 border-t border-primary/10">
        <form onSubmit={handleSubmit} className="flex space-x-2 items-center">
          <Input
            value={input}
            onChange={handleInputChange}
            placeholder="Type a message..."
            className="flex-1"
          />
          <Button type="submit">Send</Button>
        </form>
      </div>

      {/* Render the connection notification if needed */}
      {isNeeded && provider && (
        <ConnectionNotification
          provider={provider}
          onSuccess={() => {
            hideNotification();
            // We could add additional success handling here
          }}
          onCancel={hideNotification}
        />
      )}
    </div>
  );
}
