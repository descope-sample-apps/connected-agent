"use client";

import { useState } from "react";
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
    <Card className="w-full max-w-2xl mx-auto my-4 border-2 border-yellow-500/20 bg-yellow-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-yellow-500">
          <Lock className="h-5 w-5" />
          {message}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          {alternativeMessage}
        </p>
        {requiredScopes.length > 0 && (
          <div className="mt-2 text-sm">
            <p className="font-medium text-yellow-500">Required Permissions:</p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              {requiredScopes.map((scope, index) => (
                <li key={index} className="text-muted-foreground">
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
          className="w-full"
          variant="default"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <ExternalLink className="mr-2 h-4 w-4" />
              {connectButtonText}
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
