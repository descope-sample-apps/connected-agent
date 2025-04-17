import { cn } from "@/lib/utils";
import { Message } from "ai";
import { ToolResponseRenderer } from "@/components/ui/tool-response-renderer";
import React, { useMemo, useState, useEffect, useRef } from "react";
import { User, Bot, Sparkles } from "lucide-react";

// Add keyframe animations
const messageEnterAnimation = `
  @keyframes messageEnter {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

const shimmerAnimation = `
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
`;

const pulseAnimation = `
  @keyframes subtlePulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.01); }
  }
`;

interface ToolCall {
  id: string;
  type: string;
  function: {
    name: string;
    arguments: string; // Note: arguments might be parsed object in some contexts
  };
}

interface ToolResult {
  tool_call_id?: string;
  tool_name?: string;
  name?: string; // Alternative field name
  result?: any; // The actual result from the tool
  ui?: any; // Our custom UI structure
  status?: "success" | "error";
  error?: string;
  needsConnection?: boolean;
  provider?: string;
}

// Extend the Message type from 'ai' to include potential tool calls and results
interface ExtendedMessage extends Message {
  tool_calls?: ToolCall[];
  tool_results?: ToolResult[]; // Assuming results might come in this property
  // Add UI structure that might be attached to messages
  ui?: {
    type: string;
    service?: string;
    message?: string;
    connectButton?: {
      text: string;
      action: string;
    };
  };
}

interface ChatMessageProps {
  message: ExtendedMessage;
  // Add onReconnectComplete prop if needed based on usage in page.tsx
  onReconnectComplete?: () => void;
}

// Helper to find a relevant tool info/UI structure
const findToolInfo = (
  message: ExtendedMessage
): ToolResult | ToolCall | null => {
  // 1. Check direct ui property if it exists
  if (message.ui && message.ui.type === "connection_required") {
    console.log("Found UI directly on message:", message.ui);
    return { ui: message.ui };
  }

  // 2. Check in tool_results
  if (message.tool_results && Array.isArray(message.tool_results)) {
    // Find any result with a UI object
    const uiResult = message.tool_results.find(
      (result) =>
        result && result.ui && result.ui.type === "connection_required"
    );

    if (uiResult) {
      console.log("Found tool result with UI:", uiResult);
      return uiResult;
    }
  }

  // 3. Check for UI in tool_calls response
  if (message.tool_calls && Array.isArray(message.tool_calls)) {
    for (const call of message.tool_calls) {
      if (call.function?.arguments) {
        try {
          const args = JSON.parse(call.function.arguments);
          if (args.ui && args.ui.type === "connection_required") {
            console.log("Found UI in tool call arguments:", args.ui);
            return { ui: args.ui };
          }
        } catch (e) {
          // Skip if not parseable JSON
        }
      }
    }
  }

  return null;
};

// Helper to parse message content for connection prompts
const parseMessageForConnections = (content: string): ToolResult | null => {
  // Patterns to detect different connection types
  const googleDocsPattern = /connect (your|to) (Google Docs|google docs)/i;
  const googleCalendarPattern =
    /connect (your|to) (Google Calendar|google calendar)/i;
  const slackPattern = /connect (your|to) (Slack|slack)/i;

  // Check for Google Docs connection
  if (googleDocsPattern.test(content)) {
    console.log("Detected Google Docs connection prompt in content");
    return {
      status: "error",
      needsConnection: true,
      provider: "google-docs",
      ui: {
        type: "connection_required",
        service: "google-docs",
        message: "Please connect your Google Docs account to create documents.",
        requiredScopes: ["https://www.googleapis.com/auth/documents"],
        connectButton: {
          text: "Connect Google Docs",
          action: "connection://google-docs",
        },
      },
    };
  }

  // Check for Google Calendar connection
  if (googleCalendarPattern.test(content)) {
    console.log("Detected Google Calendar connection prompt in content");
    return {
      status: "error",
      needsConnection: true,
      provider: "google-calendar",
      ui: {
        type: "connection_required",
        service: "google-calendar",
        message:
          "Please connect your Google Calendar account to create events.",
        connectButton: {
          text: "Connect Google Calendar",
          action: "connection://google-calendar",
        },
      },
    };
  }

  // Check for Slack connection
  if (slackPattern.test(content)) {
    console.log("Detected Slack connection prompt in content");
    return {
      status: "error",
      needsConnection: true,
      provider: "slack",
      ui: {
        type: "connection_required",
        service: "slack",
        message: "Please connect your Slack account to send messages.",
        connectButton: {
          text: "Connect Slack",
          action: "connection://slack",
        },
      },
    };
  }

  return null;
};

export function ChatMessage({
  message,
  onReconnectComplete,
}: ChatMessageProps) {
  const isUser = message.role === "user";
  const [isTyping, setIsTyping] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const messageRef = useRef<HTMLDivElement>(null);

  // Add typing animation effect for assistant messages
  useEffect(() => {
    if (!isUser && message.content) {
      setIsTyping(true);
      const timer = setTimeout(() => setIsTyping(false), 500);
      return () => clearTimeout(timer);
    }
  }, [message.content, isUser]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  // Find the relevant tool information (result with UI, result, or call)
  const toolInfo = findToolInfo(message);

  // If we're not a user message and no tool info was found, try to parse the message content
  const contentBasedToolInfo = useMemo(() => {
    if (!isUser && !toolInfo && typeof message.content === "string") {
      return parseMessageForConnections(message.content);
    }
    return null;
  }, [isUser, toolInfo, message.content]);

  // Use either the existing tool info or the content-based tool info
  const finalToolInfo = toolInfo || contentBasedToolInfo;

  // Determine if we should render the ToolResponseRenderer
  const shouldRenderToolInfo = !!finalToolInfo;

  // Potentially strip connection prompt text if we're going to render a UI for it
  const displayContent = useMemo(() => {
    if (contentBasedToolInfo && typeof message.content === "string") {
      // If we found a connection in the text and are rendering UI for it,
      // optionally clean up the text to avoid duplication
      // For simplicity, we'll keep the original text for now
      return message.content;
    }
    return message.content;
  }, [message.content, contentBasedToolInfo]);

  console.log("Message with tool results:", message);
  console.log("Parsed tool info:", finalToolInfo);

  return (
    <>
      <style jsx>{`
        ${messageEnterAnimation}
        ${shimmerAnimation}
        ${pulseAnimation}
        
        .message-container {
          animation: messageEnter 0.3s ease-out forwards;
          animation-delay: ${isUser ? "0ms" : "150ms"};
        }

        .shimmer-effect {
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.5),
            transparent
          );
          background-size: 200% 100%;
          animation: shimmer 2s infinite;
        }

        .subtle-pulse {
          animation: subtlePulse 3s ease-in-out infinite;
        }
      `}</style>
      <div
        ref={messageRef}
        className={cn(
          "flex w-full items-start gap-4 p-4 transition-all duration-300 ease-in-out message-container",
          isVisible ? "opacity-100" : "opacity-0",
          isUser
            ? "bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            : "bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900"
        )}
        style={{
          boxShadow: isUser ? "none" : "0 1px 3px rgba(0,0,0,0.05)",
          transformOrigin: isUser ? "right" : "left",
        }}
      >
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-md border shadow transition-all duration-200 hover:scale-105",
                isUser
                  ? "bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700"
                  : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700",
                !isUser && "subtle-pulse"
              )}
            >
              {isUser ? (
                <User className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
              ) : (
                <Bot className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center">
                <p className="text-sm font-medium">
                  {isUser ? "You" : "Assistant"}
                </p>
                {!isUser && (
                  <Sparkles className="h-3 w-3 ml-1 text-indigo-400 opacity-70" />
                )}
              </div>
              <div className="relative">
                <p
                  className={cn(
                    "text-sm text-zinc-500 dark:text-zinc-400 whitespace-pre-wrap transition-opacity duration-200",
                    isTyping ? "opacity-50" : "opacity-100"
                  )}
                >
                  {displayContent}
                </p>
                {isTyping && (
                  <div className="absolute inset-0 flex items-center">
                    <div className="flex space-x-1">
                      <div
                        className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce"
                        style={{ animationDelay: "0ms" }}
                      />
                      <div
                        className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce"
                        style={{ animationDelay: "150ms" }}
                      />
                      <div
                        className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce"
                        style={{ animationDelay: "300ms" }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          {shouldRenderToolInfo && finalToolInfo && (
            <div className="mt-2 pl-10 animate-in fade-in slide-in-from-bottom-2 duration-300 relative overflow-hidden">
              <div className="absolute inset-0 pointer-events-none shimmer-effect opacity-20"></div>
              <ToolResponseRenderer
                toolInvocation={finalToolInfo}
                onReconnectComplete={onReconnectComplete}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
