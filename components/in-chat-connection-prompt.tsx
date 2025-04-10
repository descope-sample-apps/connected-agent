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
import { ExternalLink, Calendar, Database, Lock, Zap } from "lucide-react";
import { connectToOAuthProvider, handleOAuthPopup } from "@/lib/oauth-utils";
import { useToast } from "./ui/use-toast";
import { Loader2 } from "lucide-react";

interface InChatConnectionPromptProps {
  service: string;
  message: string;
  connectButtonText: string;
  connectButtonAction: string;
  alternativeMessage?: string;
  chatId?: string;
}

export default function InChatConnectionPrompt({
  service,
  message,
  connectButtonText,
  connectButtonAction,
  alternativeMessage,
  chatId,
}: InChatConnectionPromptProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

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

      // Use OAuth popup mechanism instead of direct redirect
      // We want to stay on the same page when connecting from the chat

      // Construct redirect URL back to the chat
      const redirectUrl = `${
        window.location.origin
      }/api/oauth/callback?redirectTo=chat${chatId ? `&chatId=${chatId}` : ""}`;

      // Get the authorization URL
      const url = await connectToOAuthProvider({
        appId: providerId,
        redirectUrl,
        state: {
          redirectTo: "chat",
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

          // Reload the page to retry the conversation with the new connection
          if (chatId) {
            window.location.reload();
          }
        },
        onError: (error) => {
          setIsLoading(false);
          toast({
            title: "Connection failed",
            description: error.message || "Failed to connect to service",
            variant: "destructive",
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
    }
  };

  const getIcon = () => {
    switch (service.toLowerCase()) {
      case "google calendar":
        return <Calendar className="h-7 w-7 text-blue-500" />;
      case "crm":
        return <Database className="h-7 w-7 text-emerald-500" />;
      default:
        return <ExternalLink className="h-7 w-7 text-primary" />;
    }
  };

  return (
    <Card className="border-primary/20 bg-white dark:bg-gray-900 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3 flex-1 mr-4">
          <div className="h-10 w-10 rounded-full bg-primary/10 dark:bg-primary/15 flex items-center justify-center">
            {getIcon()}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">
              {message || `Connect your ${service} to continue`}
            </p>
            {alternativeMessage && (
              <p className="mt-1 text-xs text-muted-foreground">
                {alternativeMessage}
              </p>
            )}
          </div>
        </div>
        <Button
          size="sm"
          onClick={handleConnect}
          disabled={isLoading}
          className="bg-primary hover:bg-primary/90 shadow-sm whitespace-nowrap"
        >
          {isLoading ? (
            <span className="flex items-center">
              <span className="mr-1.5 h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"></span>
              Connecting
            </span>
          ) : (
            <>Connect</>
          )}
        </Button>
      </div>
    </Card>
  );
}
