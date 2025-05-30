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
import { Lock, ExternalLink } from "lucide-react";
import { connectToOAuthProvider, handleOAuthPopup } from "@/lib/oauth-utils";

interface InChatAuthPromptProps {
  service: string;
  description: string;
  onConnect: () => void;
  onCancel: () => void;
  providerId: string;
  scopes: string[];
}

export default function InChatAuthPrompt({
  service,
  description,
  onConnect,
  onCancel,
  providerId,
  scopes,
}: InChatAuthPromptProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleConnect = async () => {
    setIsLoading(true);
    try {
      // Get the current URL and preserve any existing query parameters
      const currentUrl = new URL(window.location.href);
      const searchParams = new URLSearchParams(currentUrl.search);

      // Add OAuth success flag
      searchParams.set("oauth", "success");

      // Construct the redirect URL with preserved context
      const redirectUrl = `${currentUrl.origin}${
        currentUrl.pathname
      }?${searchParams.toString()}`;

      const url = await connectToOAuthProvider({
        appId: providerId,
        redirectUrl,
        scopes,
      });

      // Use the OAuth popup handler
      handleOAuthPopup(url, {
        onSuccess: () => {
          setIsLoading(false);
          onConnect();
        },
        onError: (error) => {
          console.error("Failed to connect to provider:", error);
          setIsLoading(false);
          alert(error.message || "Connection failed");
        },
      });
    } catch (error) {
      console.error("Failed to connect to provider:", error);
      setIsLoading(false);
      alert(error instanceof Error ? error.message : "Connection failed");
    }
  };

  return (
    <Card className="border-primary/20 bg-primary/5 dark:bg-primary/10">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-base">Connect to {service}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pb-2">
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
      <CardFooter className="flex justify-end gap-2 pt-0">
        <Button
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={isLoading}
        >
          Not now
        </Button>
        <Button size="sm" onClick={handleConnect} disabled={isLoading}>
          {isLoading ? (
            <span className="flex items-center">
              <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></span>
              Connecting...
            </span>
          ) : (
            <>
              <ExternalLink className="mr-1 h-4 w-4" />
              Connect {service}
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
