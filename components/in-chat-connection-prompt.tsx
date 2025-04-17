"use client";

import { useState, useRef, useEffect } from "react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ExternalLink,
  Calendar,
  Database,
  Lock,
  Zap,
  Video,
  FileText,
} from "lucide-react";
import { connectToOAuthProvider, handleOAuthPopup } from "@/lib/oauth-utils";
import { useToast } from "./ui/use-toast";
import { Loader2 } from "lucide-react";
import { trackOAuthEvent } from "@/lib/analytics";
import { useAuth } from "@/context/auth-context";

const pulseAnimation = `
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }
`;

const fadeInAnimation = `
  @keyframes fadeIn {
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

interface InChatConnectionPromptProps {
  service: string;
  message: string;
  connectButtonText: string;
  connectButtonAction: string;
  alternativeMessage?: string;
  chatId?: string;
  requiredScopes?: string[];
  currentScopes?: string[];
}

export default function InChatConnectionPrompt({
  service,
  message,
  connectButtonText,
  connectButtonAction,
  alternativeMessage,
  chatId,
  requiredScopes = [],
  currentScopes = [],
}: InChatConnectionPromptProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // Extract the provider ID from the connection action
  const getProviderId = () => {
    const url = connectButtonAction;
    // Extract provider from connection://provider format
    if (url.startsWith("connection://")) {
      return url.replace("connection://", "");
    }
    // Fallback to service name
    return service.toLowerCase().replace(" ", "-");
  };

  const handleConnect = async () => {
    setIsLoading(true);
    try {
      // Extract the provider ID
      const providerId = getProviderId();

      // Track connection attempt in Segment
      if (
        typeof window !== "undefined" &&
        window.analytics &&
        typeof window.analytics.track === "function"
      ) {
        window.analytics.track("connection_initiated", {
          provider: providerId,
          service: service,
          userId: user?.id,
          chatId: chatId,
          requiredScopes,
          currentScopes,
          timestamp: new Date().toISOString(),
        });
      }

      // Also track using the OAuth tracking function for consistency
      trackOAuthEvent("connection_initiated", {
        provider: providerId,
        service: service,
        userId: user?.id,
        chatId: chatId,
        requiredScopes,
        currentScopes,
      });

      // Simple redirect URL without query parameters
      const redirectUrl = `${window.location.origin}/api/oauth/callback`;

      // Get the authorization URL with required scopes
      const url = await connectToOAuthProvider({
        appId: providerId,
        redirectUrl,
        scopes: requiredScopes.length > 0 ? requiredScopes : undefined,
        state: {
          chatId,
          originalUrl: window.location.href,
        },
      });

      // Handle the OAuth popup
      await handleOAuthPopup(url, {
        onSuccess: () => {
          setIsLoading(false);
          toast({
            title: "Connected successfully",
            description: `Successfully connected to ${service}`,
          });

          // Track successful connection in Segment
          if (
            typeof window !== "undefined" &&
            window.analytics &&
            typeof window.analytics.track === "function"
          ) {
            window.analytics.track("connection_successful", {
              provider: providerId,
              service: service,
              userId: user?.id,
              chatId: chatId,
              timestamp: new Date().toISOString(),
            });
          }

          // Also track using the OAuth tracking function
          trackOAuthEvent("connection_successful", {
            provider: providerId,
            service: service,
            userId: user?.id,
            chatId: chatId,
          });

          // Don't reload, instead update the UI to indicate connection is successful
          if (typeof window !== "undefined") {
            // Dispatch a custom event that the chat component can listen for
            const event = new CustomEvent("connection-success", {
              detail: { service: providerId },
            });
            window.dispatchEvent(event);
          }
        },
        onError: (error) => {
          setIsLoading(false);
          toast({
            title: "Connection failed",
            description: error.message || "Failed to connect to service",
            variant: "destructive",
          });

          // Track failed connection in Segment
          if (
            typeof window !== "undefined" &&
            window.analytics &&
            typeof window.analytics.track === "function"
          ) {
            window.analytics.track("connection_failed", {
              provider: providerId,
              service: service,
              userId: user?.id,
              chatId: chatId,
              error: error.message || "Unknown error",
              timestamp: new Date().toISOString(),
            });
          }

          // Also track using the OAuth tracking function
          trackOAuthEvent("connection_failed", {
            provider: providerId,
            service: service,
            userId: user?.id,
            chatId: chatId,
            error: error.message || "Unknown error",
          });
        },
      });
    } catch (error) {
      console.error("Connection error:", error);
      setIsLoading(false);
      toast({
        title: "Connection failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to connect to service",
        variant: "destructive",
      });

      // Track connection error in analytics
      if (
        typeof window !== "undefined" &&
        window.analytics &&
        typeof window.analytics.track === "function"
      ) {
        window.analytics.track("connection_failed", {
          provider: getProviderId(),
          service: service,
          userId: user?.id,
          chatId: chatId,
          error: error instanceof Error ? error.message : "Unknown error",
          timestamp: new Date().toISOString(),
        });
      }

      // Also track using the OAuth tracking function
      trackOAuthEvent("connection_failed", {
        provider: getProviderId(),
        service: service,
        userId: user?.id,
        chatId: chatId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  const getIcon = () => {
    switch (service.toLowerCase()) {
      case "google calendar":
        return <Calendar className="h-6 w-6 text-indigo-500" />;
      case "crm":
        return <Database className="h-6 w-6 text-purple-500" />;
      case "zoom":
        return <Video className="h-6 w-6 text-indigo-500" />;
      case "google docs":
        return <FileText className="h-6 w-6 text-purple-500" />;
      default:
        return <ExternalLink className="h-6 w-6 text-indigo-500" />;
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
        className={`w-full max-w-2xl mx-auto my-4 border-2 border-yellow-500/20 bg-yellow-500/5 
        ${
          animated
            ? "animate-in fade-in slide-in-from-bottom-2 duration-500"
            : "opacity-0"
        }`}
        style={{
          boxShadow: "rgba(250, 204, 21, 0.1) 0px 4px 24px",
          transition: "all 0.3s ease-in-out",
        }}
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-yellow-500">
            <Lock
              className="h-5 w-5 animate-pulse"
              style={{ animationDuration: "2s" }}
            />
            <span className="relative">
              {message}
              <span
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, rgba(250, 204, 21, 0.1), transparent)",
                  backgroundSize: "200% 100%",
                  animation: "shimmer 2s infinite",
                  pointerEvents: "none",
                }}
              />
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent
          className="animate-in fade-in duration-700"
          style={{ animationDelay: "200ms" }}
        >
          <p className="text-sm text-muted-foreground mb-4">
            {alternativeMessage}
          </p>
          {requiredScopes.length > 0 && (
            <div
              className="mt-2 text-sm animate-in fade-in duration-700"
              style={{ animationDelay: "400ms" }}
            >
              <p className="font-medium text-yellow-500">
                Required Permissions:
              </p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                {requiredScopes.map((scope, index) => (
                  <li
                    key={index}
                    className="text-muted-foreground animate-in fade-in slide-in-from-left duration-300"
                    style={{ animationDelay: `${600 + index * 100}ms` }}
                  >
                    {scope.split("/").pop() || scope}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button
            onClick={handleConnect}
            disabled={isLoading}
            className="mx-auto px-4 py-1 transform hover:scale-105 transition-transform duration-200 shadow-md hover:shadow-lg"
            variant="default"
            size="sm"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <ExternalLink className="mr-2 h-3 w-3" />
                {connectButtonText}
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </>
  );
}
