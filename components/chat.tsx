"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useChat, Message as AIMessage } from "ai/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Loader2, AlertCircle, AlertTriangle } from "lucide-react";
import InChatConnectionPrompt from "@/components/in-chat-connection-prompt";
import { useConnectionNotification } from "@/hooks/use-connection-notification";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import ActionCard from "@/components/action-card";
import { useToast } from "@/components/ui/use-toast";
import { trackPrompt } from "@/lib/analytics";
import { useAuth } from "@/context/auth-context";
import { OAuthProvider } from "@/lib/tools/base";
import { connectToOAuthProvider, handleOAuthPopup } from "@/lib/oauth-utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

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
  toolId?: string;
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
  initialPrompt?: string;
}

export default function Chat({
  id,
  initialMessages = [],
  selectedChatModel = DEFAULT_CHAT_MODEL,
  selectedVisibilityType = "private",
  isReadonly = false,
  onNewChat,
  initialPrompt = "",
}: ChatProps) {
  const [input, setInput] = useState(initialPrompt);
  const [isLoading, setIsLoading] = useState(false);
  const [promptStartTime, setPromptStartTime] = useState<number | null>(null);
  const [usageCount, setUsageCount] = useState<number>(0);
  const [usageLimit, setUsageLimit] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [messagesWithActions, setMessagesWithActions] = useState<string[]>([]);

  const {
    messages: chatMessages,
    append,
    reload,
    stop,
  } = useChat({
    api: "/api/chat",
    body: {
      id,
      selectedChatModel,
    },
    initialMessages,
    id: id || undefined,
    onResponse: async (response) => {
      if (response.status === 429) {
        try {
          const errorData = await response.json();

          if (errorData?.error?.includes("Monthly usage limit exceeded")) {
            toast({
              title: "Monthly Usage Limit Reached",
              description:
                errorData?.message ||
                "You've reached your monthly usage limit for this service. Please check your subscription or try again next month.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Service Temporarily Unavailable",
              description:
                "We've received too many requests recently. Please try again later.",
              variant: "destructive",
            });
          }
        } catch (error) {
          toast({
            title: "Rate Limit Exceeded",
            description:
              "The service is experiencing high demand. Please try again later.",
            variant: "destructive",
          });
        }
        return;
      }

      if (response.status === 401) {
        toast({
          title: "Authentication Error",
          description: "Your session has expired. Please log in again.",
          variant: "destructive",
        });
        return;
      }

      if (response.status === 403) {
        try {
          const errorData = await response.json();
          if (errorData?.error === "insufficient_scopes") {
            return;
          }
        } catch (error) {
          console.error("Error parsing error response:", error);
        }
      }

      scrollToBottom();
    },
    onFinish: (message) => {
      setIsLoading(false);
      scrollToBottom();

      trackPrompt("prompt_completed", {
        chatId: id,
        modelName: selectedChatModel,
        success: true,
        responseTime: Date.now() - (promptStartTime || Date.now()),
      });

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
      setError(error.message || "An error occurred");

      trackPrompt("prompt_completed", {
        chatId: id,
        modelName: selectedChatModel,
        success: false,
        responseTime: Date.now() - (promptStartTime || Date.now()),
      });

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

      try {
        if (error.message) {
          const jsonMatch = error.message.match(/\{.*\}/);
          if (jsonMatch) {
            const errorData = JSON.parse(jsonMatch[0]);

            if (errorData.message) {
              setError(errorData.message);
              toast({
                title: "Error",
                description: errorData.message,
                variant: "destructive",
              });
              return;
            }
          }

          setError(error.message);
          toast({
            title: "Error",
            description: error.message,
            variant: "destructive",
          });
          return;
        }
      } catch (parseError) {
        setError(
          error.message || "An error occurred while processing your request."
        );
        toast({
          title: "Error",
          description:
            error.message || "An error occurred while processing your request.",
          variant: "destructive",
        });
      }
    },
  });

  const { toast } = useToast();
  const { user } = useAuth();
  const [usage, setUsage] = useState<{
    messageCount: number;
    monthlyLimit: number;
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const lastMessage =
    chatMessages.length > 0 ? chatMessages[chatMessages.length - 1] : null;

  const filteredMessages = useMemo(() => {
    return chatMessages
      .filter((message) => {
        if (
          !message.content &&
          (!message.parts || message.parts.length === 0)
        ) {
          return false;
        }
        return true;
      })
      .map((message: ExtendedMessage) => {
        if (
          (!message.content || message.content === "") &&
          message.parts &&
          message.parts.length > 0
        ) {
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
  }, [chatMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [filteredMessages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const { provider, isNeeded, hideNotification, checkConnections } =
    useConnectionNotification({
      message: lastMessage?.role === "assistant" ? lastMessage.content : "",
      isLLMResponse: lastMessage?.role === "assistant",
      onConnectionSucceeded: () => {
        const lastUserMessage = [...chatMessages]
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

  const markServiceConnected = (service: string) => {
    if (typeof window !== "undefined") {
      const timestamp = Date.now();
      localStorage.setItem(`last_connection_${service}`, timestamp.toString());
      console.log(
        `Marked ${service} as connected at ${new Date(timestamp).toISOString()}`
      );
    }
  };

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

  useEffect(() => {
    const handleConnectionSuccess = (event: CustomEvent) => {
      console.log("Connection success event received:", event.detail);

      if (event.detail && event.detail.service) {
        markServiceConnected(event.detail.service);
      }

      const retryImmediately = event.detail?.retryImmediately === true;

      const lastUserMessage = [...chatMessages]
        .reverse()
        .find((m) => m.role === "user");

      if (lastUserMessage) {
        console.log(
          "Connection successful, resending message:",
          lastUserMessage.content
        );

        setIsLoading(true);
        hideNotification();

        checkConnections().then(() => {
          const delayTime = retryImmediately ? 100 : 1000;

          setTimeout(() => {
            const messageToResend = lastUserMessage.content;

            setInput(messageToResend);

            const event = {
              preventDefault: () => {},
            } as React.FormEvent<HTMLFormElement>;
            append({
              content: messageToResend,
              role: "user",
            });

            setTimeout(() => {
              setIsLoading(false);
            }, 100);
          }, delayTime);
        });
      } else {
        setIsLoading(true);
        checkConnections().then(() => {
          hideNotification();
          setIsLoading(false);
        });
      }
    };

    window.addEventListener(
      "connection-success",
      handleConnectionSuccess as EventListener
    );

    return () => {
      window.removeEventListener(
        "connection-success",
        handleConnectionSuccess as EventListener
      );
    };
  }, [chatMessages, id, hideNotification, checkConnections]);

  useEffect(() => {
    const lastMessage = chatMessages[chatMessages.length - 1];
    if (lastMessage?.role === "assistant" && lastMessage.content) {
      const content = lastMessage.content.toLowerCase();

      if (
        ((content.includes("connect") &&
          (content.includes("calendar") ||
            content.includes("crm") ||
            content.includes("service"))) ||
          (content.includes("connect") && content.includes("](connection:")) ||
          (content.includes("need") &&
            (content.includes("access") || content.includes("connect")))) &&
        !messagesWithActions.includes(lastMessage.id)
      ) {
        console.log(
          "Detected connection requirement in message:",
          lastMessage.id
        );

        // Use timeout to debounce and prevent excessive updates
        const timeoutId = setTimeout(() => {
          setMessagesWithActions((prev) => [...prev, lastMessage.id]);

          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
          }, 100);
        }, 300); // Debounce for 300ms

        return () => clearTimeout(timeoutId);
      }
    }
  }, [chatMessages, messagesWithActions]);

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

  const getEnhancedGoogleDocsConnectionDetails = () => {
    return {
      text: "Connect Google Drive",
      message: "Google Drive access is required to create and save documents.",
      alternativeMessage:
        "This will allow the assistant to create and edit documents and store them on your Google Drive.",
      requiredScopes: ["https://www.googleapis.com/auth/drive.file"],
    };
  };

  const renderConnectionPrompt = (message: ExtendedMessage) => {
    let service: OAuthProvider = "google-calendar";
    let requiredScopes: string[] = [];
    let isReconnect = false;
    let customMessage = "";

    if (message.ui) {
      service = message.ui.service as OAuthProvider;
      requiredScopes = message.ui.requiredScopes || [];
      customMessage = message.ui.message;

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

    const content = message.content.toLowerCase();

    if (content.includes("crm")) service = "custom-crm";
    if (content.includes("calendar")) service = "google-calendar";
    if (content.includes("docs")) service = "google-docs";
    if (content.includes("meet")) service = "google-meet";
    if (content.includes("slack")) service = "slack";
    if (content.includes("zoom")) service = "zoom";
    if (content.includes("linkedin")) service = "linkedin";

    isReconnect =
      content.includes("additional permission") ||
      content.includes("more permission") ||
      content.includes("reconnect");

    const actionMatch = message.content.match(
      /\[([^\]]+)\]\(connection:\/\/([^)]+)\)/
    );
    let connectButtonText = actionMatch
      ? actionMatch[1]
      : `Connect ${getDisplayName(service)}`;
    const connectButtonAction = actionMatch
      ? `connection://${actionMatch[2]}`
      : `connection://${service}`;

    if (service === "google-docs") {
      const isDriveError = content.includes("drive");

      if (isDriveError) {
        const enhancedDetails = getEnhancedGoogleDocsConnectionDetails();
        connectButtonText = enhancedDetails.text;
        requiredScopes = enhancedDetails.requiredScopes;

        let messageText = isReconnect
          ? `Additional permissions are required for Google Docs & Drive.`
          : enhancedDetails.message;

        let alternativeMessage = enhancedDetails.alternativeMessage;

        return (
          <InChatConnectionPrompt
            service="Google Drive"
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
        requiredScopes.push("https://www.googleapis.com/auth/drive.file");
      }
    } else if (service === "google-calendar") {
      requiredScopes.push("https://www.googleapis.com/auth/calendar");
    } else if (service === "google-meet") {
      requiredScopes.push(
        "https://www.googleapis.com/auth/calendar",
        "https://www.googleapis.com/auth/meetings.space.created"
      );
    } else if (service === "linkedin") {
      requiredScopes.push("r_emailaddress", "r_liteprofile", "w_member_social");
    }

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
      case "linkedin":
        return "LinkedIn";
      default:
        return provider.replace(/-/g, " ");
    }
  };

  const renderMessage = (message: ExtendedMessage) => {
    if (!message.content && (!message.parts || message.parts.length === 0)) {
      return null;
    }

    const hasActionCard = message.actionCard !== undefined;
    const hasToolActions =
      message.toolActions && message.toolActions.length > 0;

    let connectionUI = null;
    if (message.role === "assistant") {
      try {
        if (message.toolActions && message.toolActions.length > 0) {
          for (const action of message.toolActions) {
            if (action.output?.ui?.type === "connection_required") {
              connectionUI = action.output.ui;
              break;
            }
          }
        }

        if (!connectionUI && message.content) {
          if (
            message.content.toLowerCase().includes("drive") &&
            (message.content.toLowerCase().includes("scope") ||
              message.content.toLowerCase().includes("permission") ||
              message.content.toLowerCase().includes("access"))
          ) {
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
                requiredScopes: ["https://www.googleapis.com/auth/drive.file"],
              },
            };
          }
        }

        if (!connectionUI && message.content) {
          const simpleConnectionRegex = /Connection to ([\w-]+) required/i;
          const simpleMatch = message.content.match(simpleConnectionRegex);

          if (simpleMatch && simpleMatch[1]) {
            const serviceName = simpleMatch[1].toLowerCase();
            let service: OAuthProvider = "google-docs";

            if (serviceName.includes("calendar")) service = "google-calendar";
            else if (serviceName.includes("meet")) service = "google-meet";
            else if (serviceName.includes("crm")) service = "custom-crm";
            else if (serviceName.includes("slack")) service = "slack";
            else if (serviceName.includes("zoom")) service = "zoom";
            else if (serviceName.includes("linkedin")) service = "linkedin";

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
                    ? ["https://www.googleapis.com/auth/drive.file"]
                    : [],
              },
            };
          }
        }

        if (!connectionUI && !message.ui && message.content) {
          const connectionUIRegex = /\{\"type\":\"connection_ui\"[^}]+\}/;
          const match = message.content.match(connectionUIRegex);
          if (match) {
            connectionUI = JSON.parse(match[0]);
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
        console.log("Error parsing embedded connection UI:", e);
      }
    }

    const showConnectionPrompt =
      message.role === "assistant" &&
      (message.ui?.type === "connection_required" ||
        (message.content &&
          ((message.content.toLowerCase().includes("connect") &&
            (message.content.toLowerCase().includes("calendar") ||
              message.content.toLowerCase().includes("crm") ||
              message.content.toLowerCase().includes("custom-crm") ||
              message.content.toLowerCase().includes("service") ||
              message.content.toLowerCase().includes("google docs") ||
              message.content.toLowerCase().includes("documents") ||
              message.content.toLowerCase().includes("drive") ||
              message.content.toLowerCase().includes("slack") ||
              message.content.toLowerCase().includes("linkedin") ||
              message.content.toLowerCase().includes("meet") ||
              message.content.toLowerCase().includes("google meet"))) ||
            message.content.includes("](connection:") ||
            message.content.includes("connection_required") ||
            message.content.includes("Connection to") ||
            message.content.includes("access required") ||
            message.content.includes("permissions") ||
            message.content.includes("authorization") ||
            message.content.includes('type":"connection_ui') ||
            (message.toolActions &&
              message.toolActions.some(
                (action) => action.output?.ui?.type === "connection_required"
              )))));

    const isToolInvocation =
      message.role === "assistant" &&
      message.content &&
      (message.content.includes('{"type":"tool-invocation"}') ||
        message.content.includes('{"type":"function-execution"}') ||
        message.content.includes('"name":"'));

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
          return null;
        }
      } catch (e) {
        // Not valid JSON, continue with normal rendering
      }
    }

    const isGeneralStreamingPlaceholder =
      message.role === "assistant" &&
      message.content &&
      !isToolInvocation &&
      (message.content.includes('{"type":"step-end"}') ||
        (message.content.startsWith("{") &&
          message.content.includes('"type":')));

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
                ? message.parts
                    .filter((part) => {
                      if (typeof part === "object" && part.type === "text") {
                        return part.text && part.text.trim() !== "";
                      }
                      return part;
                    })
                    .map((part, idx) => {
                      if (typeof part === "object" && part.type === "text") {
                        return <div key={idx}>{part.text}</div>;
                      } else if (typeof part === "string") {
                        return <div key={idx}>{part}</div>;
                      } else {
                        return null;
                      }
                    })
                : message.content}
            </div>
          )}

          {showConnectionPrompt && renderConnectionPrompt(message)}

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

                      setIsLoading(true);

                      const redirectUrl = `${window.location.origin}/api/oauth/callback`;

                      const authUrl = await connectToOAuthProvider({
                        appId: service,
                        redirectUrl,
                        scopes: message.ui.requiredScopes,
                        state: {
                          chatId: id,
                          originalUrl: window.location.href,
                          toolId: message.ui.toolId,
                        },
                      });

                      await handleOAuthPopup(authUrl, {
                        onSuccess: () => {
                          toast({
                            title: "Connected successfully",
                            description: `Successfully connected to ${message.ui?.service}`,
                          });

                          markServiceConnected(service);

                          const event = new CustomEvent("connection-success", {
                            detail: {
                              service: service,
                              retryImmediately: true,
                            },
                          });
                          window.dispatchEvent(event);

                          setIsLoading(false);
                        },
                        onError: (error) => {
                          toast({
                            title: "Connection failed",
                            description:
                              error.message || "Failed to connect to service",
                            variant: "destructive",
                          });

                          setIsLoading(false);
                        },
                      });
                    } catch (error) {
                      console.error("Error connecting:", error);

                      toast({
                        title: "Connection failed",
                        description:
                          error instanceof Error
                            ? error.message
                            : "Failed to connect to service",
                        variant: "destructive",
                      });

                      setIsLoading(false);
                    }
                  }
                }}
                className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-500/90 hover:to-purple-600/90 text-white rounded-lg shadow-sm transition-colors"
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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    setPromptStartTime(Date.now());
    setError(null);

    trackPrompt("prompt_submitted", {
      userId: user?.id,
      promptText: input.trim(),
      chatId: id,
      modelName: selectedChatModel,
    });

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
      await append({
        content: input.trim(),
        role: "user",
      });
    } catch (error) {
      console.error("Error submitting message:", error);
      setIsLoading(false);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    }
    setInput("");
  };

  useEffect(() => {
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
      {error && (
        <div className="mb-4 mx-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => {
                setError(null);
                reload();
              }}
            >
              Retry
            </Button>
          </Alert>
        </div>
      )}

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

      <div className="flex-1 overflow-auto p-4 sm:p-6 pb-0 sm:pb-0">
        <div className="max-w-4xl mx-auto">
          {filteredMessages.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-5xl mx-auto w-full">
              <div className="w-20 h-20 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 rounded-full flex items-center justify-center mb-6 border border-indigo-100 dark:border-indigo-900/40 shadow-md">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-10 w-10 text-indigo-500"
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

              <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
                CRM Assistant
              </h1>
              <p className="text-muted-foreground text-center max-w-md mb-8 text-lg">
                Your AI-powered assistant for managing CRM data, calendar, and
                business tasks.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl mb-10">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all">
                  <div className="rounded-full w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mb-4">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 text-indigo-600 dark:text-indigo-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"
                      />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-lg mb-2">
                    Natural Conversations
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Ask questions in plain English about your CRM data, schedule
                    meetings, or manage tasks.
                  </p>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all">
                  <div className="rounded-full w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mb-4">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 text-indigo-600 dark:text-indigo-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                      />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-lg mb-2">
                    Integrated Services
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Connect your CRM, Google Calendar, Google Meet, and other
                    tools to work seamlessly.
                  </p>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all">
                  <div className="rounded-full w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mb-4">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 text-indigo-600 dark:text-indigo-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                      />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-lg mb-2">Secure Access</h3>
                  <p className="text-muted-foreground text-sm">
                    OAuth integration keeps your data secure while enabling
                    powerful AI assistance.
                  </p>
                </div>
              </div>

              <div className="w-full max-w-4xl mb-10 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 p-8 rounded-xl border border-indigo-100 dark:border-indigo-900/40">
                <h2 className="text-2xl font-bold mb-4 text-center">
                  How It Works
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                  <div className="flex flex-col items-center">
                    <div className="rounded-full w-12 h-12 bg-white dark:bg-gray-800 border border-indigo-100 dark:border-indigo-800 flex items-center justify-center mb-4 shadow-sm">
                      <span className="text-xl font-bold text-indigo-600">
                        1
                      </span>
                    </div>
                    <h3 className="font-medium text-center mb-2">
                      Connect Your Services
                    </h3>
                    <p className="text-sm text-center text-muted-foreground">
                      Securely connect your CRM, calendar, and other services
                      with OAuth.
                    </p>
                  </div>

                  <div className="flex flex-col items-center">
                    <div className="rounded-full w-12 h-12 bg-white dark:bg-gray-800 border border-indigo-100 dark:border-indigo-800 flex items-center justify-center mb-4 shadow-sm">
                      <span className="text-xl font-bold text-indigo-600">
                        2
                      </span>
                    </div>
                    <h3 className="font-medium text-center mb-2">
                      Ask Questions
                    </h3>
                    <p className="text-sm text-center text-muted-foreground">
                      Ask anything about your data, schedule meetings, or create
                      reports.
                    </p>
                  </div>

                  <div className="flex flex-col items-center">
                    <div className="rounded-full w-12 h-12 bg-white dark:bg-gray-800 border border-indigo-100 dark:border-indigo-800 flex items-center justify-center mb-4 shadow-sm">
                      <span className="text-xl font-bold text-indigo-600">
                        3
                      </span>
                    </div>
                    <h3 className="font-medium text-center mb-2">
                      Get Results
                    </h3>
                    <p className="text-sm text-center text-muted-foreground">
                      Receive instant answers and actions based on your
                      connected data.
                    </p>
                  </div>
                </div>

                <div className="flex justify-center mt-6">
                  <a
                    href="/how-it-works"
                    className="px-4 py-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg shadow-sm text-sm text-indigo-600 dark:text-indigo-400 font-medium border border-indigo-100 dark:border-indigo-800 transition-colors"
                  >
                    Learn more about Inbound Apps
                  </a>
                </div>
              </div>

              <div className="w-full max-w-4xl mb-10">
                <h2 className="text-2xl font-bold mb-4 text-center">
                  Try asking about...
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button className="p-3 text-left bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm transition-colors">
                    <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                      Show me recent deals with Acme Inc
                    </span>
                  </button>

                  <button className="p-3 text-left bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm transition-colors">
                    <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                      Schedule a meeting with Sarah tomorrow at 2pm PST
                    </span>
                  </button>

                  <button className="p-3 text-left bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm transition-colors">
                    <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                      Create a report of this month's sales
                    </span>
                  </button>

                  <button className="p-3 text-left bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm transition-colors">
                    <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                      Find contacts who haven't been reached in 30 days
                    </span>
                  </button>
                </div>
              </div>

              <div className="w-full max-w-4xl text-center pb-6">
                <h2 className="text-lg font-medium mb-3">Resources</h2>
                <div className="flex justify-center space-x-4 text-sm">
                  <a
                    href="/docs"
                    className="text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Documentation
                  </a>
                  <a
                    href="/privacy"
                    className="text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Privacy Policy
                  </a>
                  <a
                    href="/support"
                    className="text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Support
                  </a>
                </div>
              </div>
            </div>
          )}

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
              <div className="w-20 h-20 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 rounded-full flex items-center justify-center mb-6 border border-indigo-100 dark:border-indigo-900/40 shadow-md">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-10 w-10 text-indigo-500"
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

              <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
                CRM Assistant
              </h1>
              <p className="text-muted-foreground text-center max-w-md mb-8 text-lg">
                Your AI-powered assistant for managing CRM data, calendar, and
                business tasks.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl mb-10">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all">
                  <div className="rounded-full w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mb-4">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 text-indigo-600 dark:text-indigo-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"
                      />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-lg mb-2">
                    Natural Conversations
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Ask questions in plain English about your CRM data, schedule
                    meetings, or manage tasks.
                  </p>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all">
                  <div className="rounded-full w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mb-4">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 text-indigo-600 dark:text-indigo-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                      />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-lg mb-2">
                    Integrated Services
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Connect your CRM, Google Calendar, Google Meet, and other
                    tools to work seamlessly.
                  </p>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all">
                  <div className="rounded-full w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mb-4">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 text-indigo-600 dark:text-indigo-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                      />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-lg mb-2">Secure Access</h3>
                  <p className="text-muted-foreground text-sm">
                    OAuth integration keeps your data secure while enabling
                    powerful AI assistance.
                  </p>
                </div>
              </div>

              <div className="w-full max-w-4xl mb-10 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 p-8 rounded-xl border border-indigo-100 dark:border-indigo-900/40">
                <h2 className="text-2xl font-bold mb-4 text-center">
                  How It Works
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                  <div className="flex flex-col items-center">
                    <div className="rounded-full w-12 h-12 bg-white dark:bg-gray-800 border border-indigo-100 dark:border-indigo-800 flex items-center justify-center mb-4 shadow-sm">
                      <span className="text-xl font-bold text-indigo-600">
                        1
                      </span>
                    </div>
                    <h3 className="font-medium text-center mb-2">
                      Connect Your Services
                    </h3>
                    <p className="text-sm text-center text-muted-foreground">
                      Securely connect your CRM, calendar, and other services
                      with OAuth.
                    </p>
                  </div>

                  <div className="flex flex-col items-center">
                    <div className="rounded-full w-12 h-12 bg-white dark:bg-gray-800 border border-indigo-100 dark:border-indigo-800 flex items-center justify-center mb-4 shadow-sm">
                      <span className="text-xl font-bold text-indigo-600">
                        2
                      </span>
                    </div>
                    <h3 className="font-medium text-center mb-2">
                      Ask Questions
                    </h3>
                    <p className="text-sm text-center text-muted-foreground">
                      Ask anything about your data, schedule meetings, or create
                      reports.
                    </p>
                  </div>

                  <div className="flex flex-col items-center">
                    <div className="rounded-full w-12 h-12 bg-white dark:bg-gray-800 border border-indigo-100 dark:border-indigo-800 flex items-center justify-center mb-4 shadow-sm">
                      <span className="text-xl font-bold text-indigo-600">
                        3
                      </span>
                    </div>
                    <h3 className="font-medium text-center mb-2">
                      Get Results
                    </h3>
                    <p className="text-sm text-center text-muted-foreground">
                      Receive instant answers and actions based on your
                      connected data.
                    </p>
                  </div>
                </div>

                <div className="flex justify-center mt-6">
                  <a
                    href="/how-it-works"
                    className="px-4 py-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg shadow-sm text-sm text-indigo-600 dark:text-indigo-400 font-medium border border-indigo-100 dark:border-indigo-800 transition-colors"
                  >
                    Learn more about Inbound Apps
                  </a>
                </div>
              </div>

              <div className="w-full max-w-4xl mb-10">
                <h2 className="text-2xl font-bold mb-4 text-center">
                  Try asking about...
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button className="p-3 text-left bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm transition-colors">
                    <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                      Show me recent deals with Acme Inc
                    </span>
                  </button>

                  <button className="p-3 text-left bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm transition-colors">
                    <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                      Schedule a meeting with Sarah tomorrow at 2pm PST
                    </span>
                  </button>

                  <button className="p-3 text-left bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm transition-colors">
                    <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                      Create a report of this month's sales
                    </span>
                  </button>

                  <button className="p-3 text-left bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm transition-colors">
                    <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                      Find contacts who haven't been reached in 30 days
                    </span>
                  </button>
                </div>
              </div>

              <div className="w-full max-w-4xl text-center pb-6">
                <h2 className="text-lg font-medium mb-3">Resources</h2>
                <div className="flex justify-center space-x-4 text-sm">
                  <a
                    href="/docs"
                    className="text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Documentation
                  </a>
                  <a
                    href="/privacy"
                    className="text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Privacy Policy
                  </a>
                  <a
                    href="/support"
                    className="text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Support
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {!isReadonly && (
        <div className="border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 border-gray-200 dark:border-gray-700 focus-visible:ring-indigo-500"
              disabled={isLoading}
            />
            <Button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-500/90 hover:to-purple-600/90 text-white"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
