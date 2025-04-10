import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  Calendar,
  FileText,
  Video,
  Database,
  ExternalLink,
} from "lucide-react";
import { useOAuth } from "@/context/oauth-context";
import Image from "next/image";
import { connectToOAuthProvider } from "@/lib/oauth-utils";

// Service logo mapping
const SERVICE_LOGOS = {
  zoom: "/logos/zoom-logo.png",
  "google-calendar": "/logos/google-calendar.png",
  crm: "/logos/crm-logo.png",
};

// Service display names
const SERVICE_NAMES = {
  zoom: "Zoom",
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

  // Handle connection button click - Direct connection without dialog
  const handleConnectionClick = async (service: string, action: string) => {
    console.log(`Connection button clicked for ${service}`);

    // Extract the service from the action URI
    const serviceType = action.replace("connection://", "");
    console.log(`Initiating direct OAuth flow for ${serviceType}`);

    try {
      // Get current URL to redirect back to
      const currentUrl = window.location.href;

      // Initiate direct connection flow
      const authUrl = await connectToOAuthProvider({
        appId: serviceType,
        redirectUrl: currentUrl,
        // This will use the default scopes from the OpenAPI discovery
      });

      // Directly redirect to the OAuth provider
      window.location.href = authUrl;
    } catch (e) {
      console.error("Error initiating OAuth flow:", e);
      // Fallback to dialog approach if direct connection fails
      setReconnectInfo({ appId: serviceType, scopes: [] });
      setShowReconnectDialog(true);
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

  // Parse link syntax in message content
  const renderMessageContent = (content: string) => {
    // Debug logging
    console.log(
      "Rendering message content:",
      content.length > 100 ? content.substring(0, 100) + "..." : content
    );

    // First, extract any connection UI marker
    const connectionMarkerRegex = /<connection:([\s\S]+?)>/;
    let connectionUI = null;
    let cleanedContent = content;

    // Check for connection marker
    const connectionMatch = content.match(connectionMarkerRegex);
    if (connectionMatch) {
      try {
        console.log(
          "Found connection marker:",
          connectionMatch[1].substring(0, 50) + "..."
        );
        connectionUI = JSON.parse(connectionMatch[1]);
        console.log("Parsed connection UI:", connectionUI);

        // Remove the connection marker from the content
        cleanedContent = content.replace(connectionMarkerRegex, "").trim();
      } catch (e) {
        console.error("Error parsing connection marker:", e);
      }
    } else {
      // Also check for explicit mentions of connecting services
      const connectionMentionRegex =
        /connect (your|to) (Zoom|Google Calendar|CRM)/i;
      const mentionMatch = content.match(connectionMentionRegex);

      if (mentionMatch) {
        console.log("Found connection mention:", mentionMatch[0]);
        const service = mentionMatch[2].toLowerCase();
        let serviceId = "unknown";

        if (service.includes("zoom")) serviceId = "zoom";
        else if (service.includes("calendar")) serviceId = "google-calendar";
        else if (service.includes("crm")) serviceId = "crm";

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

    // Check for special link format: <link:URL:TEXT>
    const linkRegex = /<link:(https?:\/\/[^:]+):([^>]+)>/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    // Find all links and split the content
    while ((match = linkRegex.exec(cleanedContent)) !== null) {
      if (match.index > lastIndex) {
        // Add the text before the link
        parts.push(
          <span key={`text-${lastIndex}`}>
            {cleanedContent.substring(lastIndex, match.index)}
          </span>
        );
      }

      // Add the link
      const [, url, text] = match;
      parts.push(
        <a
          key={`link-${match.index}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          {text}
        </a>
      );

      lastIndex = match.index + match[0].length;
    }

    // Add any remaining text
    if (lastIndex < cleanedContent.length) {
      parts.push(
        <span key={`text-${lastIndex}`}>
          {cleanedContent.substring(lastIndex)}
        </span>
      );
    }

    // Add connection UI if found
    if (connectionUI && connectionUI.type === "connection_required") {
      console.log("Adding connection UI to rendered message:", connectionUI);
      const serviceName =
        SERVICE_NAMES[connectionUI.service as keyof typeof SERVICE_NAMES] ||
        connectionUI.service;
      const logoPath =
        SERVICE_LOGOS[connectionUI.service as keyof typeof SERVICE_LOGOS];

      parts.push(
        <div
          key="connection-ui"
          className="mt-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm"
        >
          <div className="flex items-center mb-3">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border border-indigo-100 dark:border-indigo-900/40 flex items-center justify-center mr-2">
              {logoPath && (
                <Image
                  src={logoPath}
                  alt={`${serviceName} logo`}
                  fill
                  style={{ objectFit: "contain" }}
                />
              )}
            </div>
            <p className="text-gray-700 dark:text-gray-200 font-medium">
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
            className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-lg text-sm shadow-sm transition-colors"
          >
            {connectionUI.connectButton.text || "Connect"}
          </button>
        </div>
      );
    }

    return parts.length > 0 ? parts : cleanedContent;
  };

  // Get icon for a service
  const getIcon = (service: string) => {
    const serviceLower = service.toLowerCase();
    if (
      serviceLower === "google-calendar" ||
      serviceLower.includes("calendar")
    ) {
      return <Calendar className="h-4 w-4 text-indigo-500" />;
    } else if (
      serviceLower === "google-docs" ||
      serviceLower.includes("docs")
    ) {
      return <FileText className="h-4 w-4 text-purple-500" />;
    } else if (serviceLower === "zoom" || serviceLower.includes("zoom")) {
      return <Video className="h-4 w-4 text-indigo-500" />;
    } else if (serviceLower === "crm" || serviceLower.includes("crm")) {
      return <Database className="h-4 w-4 text-purple-500" />;
    } else {
      return <ExternalLink className="h-4 w-4 text-indigo-500" />;
    }
  };

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
          message.parts.map((part, index) => (
            <div key={index}>
              {typeof part.text === "string"
                ? renderMessageContent(part.text)
                : part.text}
            </div>
          ))
        ) : (
          <div>{renderMessageContent(message.content)}</div>
        )}
      </div>
    </div>
  );
}
