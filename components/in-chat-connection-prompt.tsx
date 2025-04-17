"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Lock,
  ExternalLink,
  Loader2,
  Calendar,
  Database,
  Video,
  FileText,
} from "lucide-react";
import { trackOAuthEvent } from "@/lib/analytics";

interface InChatConnectionPromptProps {
  service: string;
  message: string;
  alternativeMessage: string;
  connectButtonText: string;
  requiredScopes: string[];
  currentScopes?: string[];
  onConnect?: () => Promise<{ success: boolean }>;
  connectButtonAction?: string;
  chatId?: string;
  animated?: boolean;
}

const pulseAnimation = `
  @keyframes pulse {
    0% {
      opacity: 0.6;
    }
    50% {
      opacity: 1;
    }
    100% {
      opacity: 0.6;
    }
  }
`;

const fadeInAnimation = `
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-in {
    animation: fadeIn 0.5s ease-out forwards;
  }

  .fade-in {
    opacity: 0;
    animation: fadeIn 0.5s ease-out forwards;
  }

  .slide-in-from-bottom-2 {
    transform: translateY(10px);
  }
`;

const shimmerAnimation = `
  @keyframes shimmer {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }
`;

export default function InChatConnectionPrompt({
  service,
  message,
  alternativeMessage,
  connectButtonText,
  requiredScopes,
  currentScopes = [],
  onConnect,
  connectButtonAction,
  chatId,
  animated = true,
}: InChatConnectionPromptProps) {
  const [isLoading, setIsLoading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (cardRef.current) {
        cardRef.current.style.opacity = "1";
      }
    }, 100);

    // Track that we showed the connection prompt
    trackOAuthEvent("connection_initiated", {
      service: service.toLowerCase(),
      required_scopes: requiredScopes,
    });

    return () => clearTimeout(timeoutId);
  }, [service, requiredScopes]);

  const getProviderId = () => {
    // Convert service name to provider id format expected by the backend
    const serviceMap: Record<string, string> = {
      "Google Calendar": "google-calendar",
      Calendar: "google-calendar",
      CRM: "custom-crm",
      Zoom: "zoom",
      "Google Docs": "google-docs",
      "Google Meet": "google-meet",
      Slack: "slack",
    };

    return (
      serviceMap[service] || service.toLowerCase().replace(/\s+/g, "-") || ""
    );
  };

  const handleConnect = async () => {
    setIsLoading(true);

    try {
      // Track the connection attempt
      trackOAuthEvent("connection_initiated", {
        service: service.toLowerCase(),
        provider_id: getProviderId(),
        required_scopes: requiredScopes,
      });

      if (onConnect) {
        // Use the provided onConnect callback (legacy method)
        const result = await onConnect();

        if (result.success) {
          // Track successful connection
          trackOAuthEvent("connection_successful", {
            service: service.toLowerCase(),
            provider_id: getProviderId(),
          });
        } else {
          // Track failed connection
          trackOAuthEvent("connection_failed", {
            service: service.toLowerCase(),
            provider_id: getProviderId(),
          });
        }
      } else if (connectButtonAction) {
        // Use the direct connection flow
        try {
          // Extract the service from the action URI
          const serviceType = connectButtonAction.replace("connection://", "");
          console.log(`Initiating direct OAuth flow for ${serviceType}`);

          // Get current chat ID for direct redirection
          const currentChatId =
            chatId ||
            localStorage.getItem("currentChatId") ||
            `chat-${Date.now()}`;

          // Build a direct URL back to the current chat
          const directRedirectUrl = `${window.location.origin}/chat/${currentChatId}`;
          console.log(
            `Setting OAuth redirect directly to: ${directRedirectUrl}`
          );

          // Initiate direct connection flow with the required scopes
          const authUrl = await fetch(
            `/api/oauth/connect/${serviceType}?scopes=${requiredScopes.join(
              ","
            )}&chatId=${currentChatId}`
          )
            .then((res) => res.json())
            .then((data) => data.url);

          // Directly redirect to the OAuth provider
          window.location.href = authUrl;
        } catch (e) {
          console.error("Error initiating OAuth flow:", e);
          setIsLoading(false);
        }
      }
    } catch (error) {
      console.error("Connection error:", error);
      // Track connection error
      trackOAuthEvent("connection_failed", {
        service: service.toLowerCase(),
        provider_id: getProviderId(),
        error: String(error),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getIcon = () => {
    const lowerService = service.toLowerCase();
    switch (lowerService) {
      case "google calendar":
        return <Calendar className="h-4 w-4 text-indigo-500" />;
      case "crm":
      case "custom-crm":
        return <Database className="h-4 w-4 text-purple-500" />;
      case "zoom":
        return <Video className="h-4 w-4 text-indigo-500" />;
      case "google docs":
        return <FileText className="h-4 w-4 text-purple-500" />;
      default:
        return <ExternalLink className="h-4 w-4 text-indigo-500" />;
    }
  };

  return (
    <>
      <style jsx>{`
        ${pulseAnimation}
        ${fadeInAnimation}
      ${shimmerAnimation}
      `}</style>
      <Card
        ref={cardRef}
        className={`w-full max-w-md mx-auto my-2 border border-yellow-500/20 bg-yellow-500/5 
        ${
          animated
            ? "animate-in fade-in slide-in-from-bottom-2 duration-500"
            : "opacity-0"
        }`}
        style={{
          boxShadow: "rgba(250, 204, 21, 0.05) 0px 2px 8px",
          transition: "all 0.3s ease-in-out",
        }}
      >
        <CardHeader className="py-2 px-3">
          <CardTitle className="flex items-center gap-2 text-yellow-500 text-sm font-medium">
            <Lock
              className="h-3 w-3 animate-pulse"
              style={{ animationDuration: "2s" }}
            />
            <span>{message}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="py-1 px-3 text-xs text-muted-foreground">
          <p>{alternativeMessage}</p>
          {requiredScopes.length > 0 && requiredScopes.length <= 3 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {requiredScopes.map((scope, index) => (
                <span
                  key={index}
                  className="inline-flex items-center text-[10px] text-muted-foreground/70 bg-muted/30 px-1.5 py-0.5 rounded"
                >
                  {scope.split("/").pop() || scope}
                </span>
              ))}
            </div>
          )}
        </CardContent>
        <CardFooter className="py-2 px-3 flex justify-end">
          <Button
            onClick={handleConnect}
            disabled={isLoading}
            className="h-7 px-2 py-0 text-xs shadow-sm"
            variant="default"
            size="sm"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                {getIcon()}
                <span className="ml-1">{connectButtonText}</span>
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </>
  );
}
