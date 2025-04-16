import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  Calendar,
  FileText,
  Video,
  Database,
  ExternalLink,
  MessageSquare,
} from "lucide-react";
import { useOAuth } from "@/context/oauth-context";
import Image from "next/image";
import { connectToOAuthProvider, handleOAuthPopup } from "@/lib/oauth-utils";
import ReactMarkdown from "react-markdown";

// Service logo mapping
const SERVICE_LOGOS = {
  "google-meet": "/logos/google-meet-logo.png",
  "google-calendar": "/logos/google-calendar.png",
  crm: "/logos/crm-logo.png",
  slack: "/logos/slack-logo.svg",
};

// Service display names
const SERVICE_NAMES = {
  "google-meet": "Google Meet",
  "google-calendar": "Google Calendar",
  crm: "CRM System",
};

interface ChatMessageProps {
  message: {
    role: string;
    content: string;
    parts?: Array<{
      type: string;
      text: string;
    }>;
    metadata?: {
      connectionUI?: {
        type: string;
        service: string;
        message: string;
        connectButton: {
          text: string;
          action: string;
        };
      };
    };
  };
  onReconnectComplete: () => void;
}

export default function ChatMessage({
  message,
  onReconnectComplete,
}: ChatMessageProps) {
  const [reconnectProvider, setReconnectProvider] = useState<string | null>(
    null
  );
  const [requiredScopes, setRequiredScopes] = useState<string[]>([]);
  const { setShowReconnectDialog, setReconnectInfo } = useOAuth();

  // Handle connection button click - Use popup instead of direct redirect
  const handleConnectionClick = async (service: string, action: string) => {
    console.log(`Connection button clicked for ${service}`);

    // Extract the service from the action URI
    const serviceType = action.replace("connection://", "");
    console.log(`Initiating OAuth popup flow for ${serviceType}`);

    try {
      // Get current chat ID for returning to the same chat
      const currentChatId =
        localStorage.getItem("currentChatId") || `chat-${Date.now()}`;

      // Prepare the OAuth flow with the API endpoint
      const redirectUrl = `${window.location.origin}/api/oauth/callback`;

      // Initiate connection flow
      const authUrl = await connectToOAuthProvider({
        appId: serviceType,
        redirectUrl,
        // Include chatId in state to return to the same chat
        state: {
          redirectTo: "chat",
          chatId: currentChatId,
        },
      });

      // Use popup flow instead of direct redirect
      await handleOAuthPopup(authUrl, {
        onSuccess: () => {
          console.log("OAuth connection successful");
          // Optional: refresh the chat or trigger the onReconnectComplete callback
          if (onReconnectComplete) {
            onReconnectComplete();
          }
        },
        onError: (error) => {
          console.error("OAuth connection failed:", error);

          // Only show reconnect dialog if it's specifically a scopes/permissions issue
          const errorMessage = error?.message || "";
          const isScopeError =
            errorMessage.includes("insufficient_scopes") ||
            errorMessage.includes("missing_scopes") ||
            errorMessage.includes("scope") ||
            errorMessage.includes("permission");

          if (isScopeError) {
            // Extract required scopes if possible
            const scopesMatch = errorMessage.match(
              /requiredScopes:\s*\[(.*?)\]/
            );
            const scopes = scopesMatch
              ? scopesMatch[1]
                  .split(",")
                  .map((s) => s.trim().replace(/"/g, ""))
                  .filter(Boolean)
              : [];

            setReconnectInfo({ appId: serviceType, scopes });
            setShowReconnectDialog(true);
          } else {
            // For general connection failures, just try again without showing reconnect dialog
            // Could show a different toast/notification here instead
            console.log("General connection error, not scope-related");
          }
        },
      });
    } catch (e) {
      console.error("Error initiating OAuth flow:", e);

      // Only show reconnect dialog for scope-related errors
      const errorMessage = e instanceof Error ? e.message : String(e);
      const isScopeError =
        errorMessage.includes("insufficient_scopes") ||
        errorMessage.includes("missing_scopes") ||
        errorMessage.includes("scope") ||
        errorMessage.includes("permission");

      if (isScopeError) {
        // Extract required scopes if possible
        const scopesMatch = errorMessage.match(/requiredScopes:\s*\[(.*?)\]/);
        const scopes = scopesMatch
          ? scopesMatch[1]
              .split(",")
              .map((s) => s.trim().replace(/"/g, ""))
              .filter(Boolean)
          : [];

        setReconnectInfo({ appId: serviceType, scopes });
        setShowReconnectDialog(true);
      }
      // For general errors, we could add a toast notification here
    }
  };

  // Check if the message contains a scope-related error
  const checkForScopeError = async (content: string) => {
    try {
      // Look for error patterns in the message
      const scopeErrorMatch = content.match(
        /(?:insufficient_scopes|connection_required).*?provider: "([^"]+)".*?requiredScopes: \[(.*?)\]/m
      );

      if (scopeErrorMatch) {
        const [, provider, scopesStr] = scopeErrorMatch;
        const scopes = scopesStr
          .split(",")
          .map((s) => s.trim().replace(/"/g, ""))
          .filter(Boolean);

        setReconnectProvider(provider);
        setRequiredScopes(scopes);

        // Show the reconnection dialog
        setReconnectInfo({ appId: provider, scopes });
        setShowReconnectDialog(true);
      }
    } catch (error) {
      console.error("Error checking for scope error:", error);
    }
  };

  // Check message content when it changes
  useEffect(() => {
    if (message.role === "assistant") {
      checkForScopeError(message.content);
    }
  }, [message]);

  // This function checks for calendar/meeting links that may not be properly parsed
  const hasCalendarLinks = (content: string) => {
    // First check for markdown links [text](url)
    const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;

    while ((match = markdownLinkRegex.exec(content)) !== null) {
      const url = match[2];
      if (
        url.includes("google.com/calendar") ||
        url.includes("calendar/event") ||
        url.includes("calendar.google.com") ||
        url.includes("eid=") ||
        url.includes("meet.google.com")
      ) {
        return true;
      }
    }

    // Then check for raw URLs
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    while ((match = urlRegex.exec(content)) !== null) {
      const url = match[1];
      if (
        url.includes("google.com/calendar") ||
        url.includes("calendar/event") ||
        url.includes("calendar.google.com") ||
        url.includes("eid=") ||
        url.includes("meet.google.com")
      ) {
        return true;
      }
    }

    return false;
  };

  // Extract calendar links from content
  const extractCalendarLinks = (content: string) => {
    const links = [];

    // First check for markdown links [text](url)
    const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;

    while ((match = markdownLinkRegex.exec(content)) !== null) {
      const text = match[1];
      const url = match[2];
      if (
        url.includes("google.com/calendar") ||
        url.includes("calendar/event") ||
        url.includes("calendar.google.com") ||
        url.includes("eid=") ||
        url.includes("meet.google.com")
      ) {
        links.push({ text, url });
      }
    }

    // Then check for raw URLs
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    while ((match = urlRegex.exec(content)) !== null) {
      const url = match[1];
      if (
        url.includes("google.com/calendar") ||
        url.includes("calendar/event") ||
        url.includes("calendar.google.com") ||
        url.includes("eid=") ||
        url.includes("meet.google.com")
      ) {
        links.push({ text: url, url });
      }
    }

    return links;
  };

  // Render calendar link button
  const CalendarLinkButton = ({
    url,
    text,
  }: {
    url: string;
    text?: string;
  }) => {
    const isCalendarLink =
      url.includes("google.com/calendar") ||
      url.includes("calendar/event") ||
      url.includes("calendar.google.com") ||
      url.includes("eid=");

    const isMeetLink = url.includes("meet.google.com");

    return (
      <div className="mt-3">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl text-sm font-medium shadow-lg hover:shadow-xl transition-all duration-200 border border-blue-400/20"
        >
          {isCalendarLink ? (
            <>
              <Calendar className="h-4 w-4" />
              <span>View Calendar Event</span>
            </>
          ) : (
            <>
              <Video className="h-4 w-4" />
              <span>Join Meeting</span>
            </>
          )}
          <ExternalLink className="h-3 w-3 ml-1 opacity-70" />
        </a>
      </div>
    );
  };

  // Parse link syntax in message content
  const renderMessageContent = (content: string) => {
    // Debug logging
    console.log(
      "Rendering message content:",
      content.length > 100 ? content.substring(0, 100) + "..." : content
    );

    // Check for calendar links
    const calendarLinks = extractCalendarLinks(content);
    const hasCalLinks = calendarLinks.length > 0;
    console.log("Found calendar links:", hasCalLinks, calendarLinks);

    // Don't use link pre-processing since we'll handle it in the ReactMarkdown components
    let cleanedContent = content;

    // First, extract any connection UI marker
    // Use a regex that works without the 's' flag by using [\s\S] instead of dot
    const connectionMarkerRegex = /<connection:([\s\S]*?)>/;
    let connectionUI = null;

    // Check for connection marker
    const connectionMatch = content.match(connectionMarkerRegex);
    // Check if connectionMatch and group 1 exist
    if (connectionMatch && connectionMatch[1]) {
      const jsonString = connectionMatch[1];
      console.log("Found potential connection marker:", jsonString);
      try {
        connectionUI = JSON.parse(jsonString);
        console.log("Successfully parsed connection UI:", connectionUI);

        // Only remove the marker if parsing was successful
        cleanedContent = content.replace(connectionMarkerRegex, "").trim();
        console.log("Content after removing marker:", cleanedContent);
      } catch (e) {
        console.error("Error parsing connection marker JSON:", e);
        console.error("Problematic JSON string:", jsonString); // Log the exact string that failed
        // Keep the original content if parsing fails
        cleanedContent = content;
      }
    } else {
      // Also check for explicit mentions of connecting services
      const connectionMentionRegex =
        /connect (your|to) (Zoom|Google Calendar|CRM|Slack)/i; // Added Slack here too
      const mentionMatch = content.match(connectionMentionRegex);

      if (mentionMatch) {
        console.log("Found connection mention:", mentionMatch[0]);
        const service = mentionMatch[2].toLowerCase();
        let serviceId = "unknown";

        if (service.includes("zoom")) serviceId = "zoom";
        else if (service.includes("calendar")) serviceId = "google-calendar";
        else if (service.includes("crm")) serviceId = "crm";
        else if (service.includes("slack")) serviceId = "slack"; // Handle Slack mention

        connectionUI = {
          type: "connection_required",
          service: serviceId,
          message: `Please connect your ${mentionMatch[2]} to continue`,
          connectButton: {
            text: `Connect ${mentionMatch[2]}`,
            action: `connection://${serviceId}`,
          },
        };
        console.log("Created connection UI from text mention:", connectionUI);
      }
    }

    // Add connection UI if found
    const connectionUIElement = connectionUI &&
      connectionUI.type === "connection_required" && (
        <div
          key="connection-ui"
          className="mt-4 p-4 bg-card rounded-xl border border-border shadow-sm animate-scaleIn"
        >
          <div className="flex items-center mb-3">
            <div className="h-8 w-8 rounded-full bg-background border border-border flex items-center justify-center mr-2 shadow-sm">
              {SERVICE_LOGOS[
                connectionUI.service as keyof typeof SERVICE_LOGOS
              ] ? (
                <Image
                  src={
                    SERVICE_LOGOS[
                      connectionUI.service as keyof typeof SERVICE_LOGOS
                    ]
                  }
                  alt={`${
                    SERVICE_NAMES[
                      connectionUI.service as keyof typeof SERVICE_NAMES
                    ] || connectionUI.service
                  } logo`}
                  width={24}
                  height={24}
                  className="object-contain"
                />
              ) : (
                // Fallback icon if logo not found (e.g., for Slack)
                getIcon(connectionUI.service) // Use getIcon as fallback
              )}
            </div>
            <p className="text-foreground font-medium">
              {connectionUI.message}
            </p>
          </div>
          <button
            onClick={() =>
              handleConnectionClick(
                connectionUI.service,
                connectionUI.connectButton.action
              )
            }
            className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium shadow-sm transition-all duration-200 active:scale-[0.98]"
          >
            {connectionUI.connectButton.text || "Connect"}
          </button>
        </div>
      );

    // Render the message content with enhanced markdown support
    return (
      <div
        className={`prose dark:prose-invert max-w-none ${
          message.role === "user"
            ? "prose-p:text-white prose-a:text-white/90 prose-code:text-white/90"
            : ""
        }`}
      >
        <ReactMarkdown
          components={{
            // Handle code blocks and inline code
            code: ({ children, className }) => {
              const language = className?.replace("language-", "");
              const isBlock = className?.includes("language-");

              if (isBlock) {
                return (
                  <pre className="bg-gray-900/90 p-4 rounded-lg overflow-x-auto my-4">
                    <code className={`${className} text-sm`}>{children}</code>
                  </pre>
                );
              }

              return (
                <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm">
                  {children}
                </code>
              );
            },
            // Handle links with improved debugging and more aggressive detection
            a: ({ href, children }) => {
              if (!href) {
                console.warn("No href provided for link:", children);
                return <span>{children}</span>;
              }

              // Log full information about the link
              console.log("ReactMarkdown link processing:", {
                href,
                children:
                  typeof children === "string"
                    ? children
                    : JSON.stringify(children),
              });

              // Check for calendar or meeting links with very broad patterns
              const isCalendarLink =
                href.includes("google.com/calendar") ||
                href.includes("calendar/event") ||
                href.includes("calendar.google.com") ||
                href.includes(".ics") ||
                href.includes("eid=");

              const isMeetLink =
                href.includes("meet.google.com") ||
                href.includes("google.com/meet");

              console.log("Enhanced link detection:", {
                isCalendarLink,
                isMeetLink,
                href,
              });

              if (isCalendarLink || isMeetLink) {
                console.log("Rendering calendar/meet button");
                // Use a span instead of div to avoid hydration error (div inside p)
                return (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl text-sm font-medium shadow-lg hover:shadow-xl transition-all duration-200 border border-blue-400/20 no-underline mt-3"
                  >
                    {isCalendarLink ? (
                      <>
                        <Calendar className="h-4 w-4" />
                        <span>View Calendar Event</span>
                      </>
                    ) : (
                      <>
                        <Video className="h-4 w-4" />
                        <span>Join Meeting</span>
                      </>
                    )}
                    <ExternalLink className="h-3 w-3 ml-1 opacity-70" />
                  </a>
                );
              }

              // Regular links
              return (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:text-primary/90 underline underline-offset-4 transition-colors"
                >
                  {children}
                </a>
              );
            },
            // Handle paragraphs
            p: ({ children }) => (
              <p className="leading-7 [&:not(:first-child)]:mt-4">{children}</p>
            ),
            // Handle unordered lists
            ul: ({ children }) => (
              <ul className="my-4 ml-6 list-disc [&>li]:mt-2">{children}</ul>
            ),
            // Handle ordered lists
            ol: ({ children }) => (
              <ol className="my-4 ml-6 list-decimal [&>li]:mt-2">{children}</ol>
            ),
          }}
        >
          {cleanedContent}
        </ReactMarkdown>

        {connectionUIElement}
      </div>
    );
  };

  // Get icon for a service
  const getIcon = (service: string) => {
    const serviceLower = service.toLowerCase();
    if (
      serviceLower === "google-calendar" ||
      serviceLower.includes("calendar")
    ) {
      return <Calendar className="h-4 w-4 text-primary" />;
    } else if (
      serviceLower === "google-docs" ||
      serviceLower.includes("docs")
    ) {
      return <FileText className="h-4 w-4 text-primary" />;
    } else if (serviceLower === "zoom" || serviceLower.includes("zoom")) {
      return <Video className="h-4 w-4 text-primary" />;
    } else if (serviceLower === "crm" || serviceLower.includes("crm")) {
      return <Database className="h-4 w-4 text-primary" />;
    } else if (serviceLower === "slack" || serviceLower.includes("slack")) {
      return <MessageSquare className="h-4 w-4 text-primary" />;
    } else {
      return <ExternalLink className="h-4 w-4 text-primary" />;
    }
  };

  return (
    <div
      className={`flex gap-3 ${
        message.role === "user" ? "flex-row-reverse" : "flex-row"
      } mb-6 last:mb-0`}
    >
      <div
        className={`w-fit max-w-[80%] px-4 py-3 rounded-2xl ${
          message.role === "user"
            ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white"
            : "bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800"
        }`}
      >
        {renderMessageContent(message.content)}
      </div>
    </div>
  );
}
