"use client";

import { useState } from "react";
import { connectToOAuthProvider, handleOAuthPopup } from "@/lib/oauth-utils";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useOAuth } from "@/context/oauth-context";

export function OAuthReconnectDialog() {
  const { showReconnectDialog, setShowReconnectDialog, reconnectInfo } =
    useOAuth();
  const [isConnecting, setIsConnecting] = useState(false);

  const handleReconnect = async () => {
    if (!reconnectInfo) return;

    try {
      setIsConnecting(true);

      // Get the current URL and preserve any existing query parameters
      const currentUrl = new URL(window.location.href);
      const searchParams = new URLSearchParams(currentUrl.search);

      // Add OAuth success flag and redirectTo parameter
      searchParams.set("oauth", "success");
      searchParams.set("redirectTo", "chat");

      // Construct the redirect URL with preserved context
      const redirectUrl = `${currentUrl.origin}${
        currentUrl.pathname
      }?${searchParams.toString()}`;

      const url = await connectToOAuthProvider({
        appId: reconnectInfo.appId,
        redirectUrl,
        scopes: reconnectInfo.scopes,
      });

      console.log(" URL:", url);

      // Use the OAuth popup handler
      handleOAuthPopup(url, {
        onSuccess: () => {
          setIsConnecting(false);
          setShowReconnectDialog(false);
        },
        onError: (error) => {
          console.error("Failed to reconnect to OAuth provider:", error);
          setIsConnecting(false);
          alert(error.message || "Connection failed");
        },
      });
    } catch (error) {
      console.error("Failed to reconnect to OAuth provider:", error);
      setIsConnecting(false);
      alert(error instanceof Error ? error.message : "Connection failed");
    }
  };

  return (
    <Dialog open={showReconnectDialog} onOpenChange={setShowReconnectDialog}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Additional Permissions Required</DialogTitle>
          <DialogDescription>
            To complete this action, we need additional permissions from your
            account. Please reconnect to grant the necessary access.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center justify-center p-6">
          <Button
            onClick={handleReconnect}
            disabled={isConnecting}
            className="w-full"
          >
            {isConnecting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Reconnecting...
              </>
            ) : (
              "Reconnect Account"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
