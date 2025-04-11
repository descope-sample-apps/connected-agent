import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { connectToOAuthProvider, handleOAuthPopup } from "@/lib/oauth-utils";
import { Loader2 } from "lucide-react";
import Image from "next/image";
import { toast } from "@/components/ui/use-toast";

interface ConnectionNotificationProps {
  provider: {
    id: string;
    name: string;
    icon: string;
    scopes?: string[];
  };
  onSuccess: () => void;
  onCancel: () => void;
  chatId?: string;
}

export function ConnectionNotification({
  provider,
  onSuccess,
  onCancel,
  chatId,
}: ConnectionNotificationProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);

  // Add effect to listen for post messages from the OAuth popup
  useEffect(() => {
    const handleOAuthMessage = (event: MessageEvent) => {
      // Verify this is a message from our OAuth flow
      if (event.data?.type === "oauth-success") {
        console.log("Received oauth-success message:", event.data);

        // If the connection was successful, call onSuccess
        setIsConnecting(false);
        setIsOpen(false);
        onSuccess();
      }
    };

    // Add event listener for messages
    window.addEventListener("message", handleOAuthMessage);

    // Clean up listener on unmount
    return () => {
      window.removeEventListener("message", handleOAuthMessage);
    };
  }, [onSuccess]);

  const handleConnect = async () => {
    try {
      setIsConnecting(true);

      // Get the current path for redirect purposes
      const currentPath = window.location.pathname;
      const isFromChat = currentPath.includes("/chat/");

      // Save the original URL for returning to the exact same place
      const originalUrl = window.location.href;

      // Determine the redirect target (chat or profile)
      const redirectTarget = isFromChat ? "chat" : "profile";

      // Construct redirect URL back to the current page
      const redirectUrl = `${
        window.location.origin
      }/api/oauth/callback?redirectTo=${redirectTarget}${
        chatId ? `&chatId=${chatId}` : ""
      }`;

      // Get the authorization URL with the current state
      const url = await connectToOAuthProvider({
        appId: provider.id,
        redirectUrl,
        scopes: provider.scopes,
        state: {
          redirectTo: redirectTarget,
          originalUrl,
          chatId,
        },
      });

      // Handle the OAuth popup
      await handleOAuthPopup(url, {
        onSuccess: async () => {
          try {
            // Verify the connection was successful
            const response = await fetch("/api/oauth/connections", {
              headers: {
                "Cache-Control": "no-cache",
                Pragma: "no-cache",
              },
              cache: "no-store",
            });

            console.log(
              "Connection verification response status:",
              response.status
            );
            console.log(
              "Connection verification headers:",
              Object.fromEntries([...response.headers.entries()])
            );

            if (!response.ok) {
              throw new Error("Failed to verify connection status");
            }

            const data = await response.json();
            console.log(
              "Connection verification data:",
              JSON.stringify(data).substring(0, 500) + "..."
            );
            const connectionData = data.connections[provider.id];

            if (
              !connectionData ||
              !connectionData.connected ||
              "error" in connectionData
            ) {
              throw new Error(
                "error" in connectionData
                  ? connectionData.error
                  : "Failed to establish connection"
              );
            }

            toast({
              title: "Connection successful",
              description: `Successfully connected to ${provider.name}`,
              variant: "default",
            });

            // Close the dialog and notify parent of success
            setIsOpen(false);
            onSuccess();
          } catch (error) {
            console.error("Error verifying connection:", error);
            toast({
              title: "Connection failed",
              description:
                error instanceof Error
                  ? error.message
                  : "Failed to verify connection",
              variant: "destructive",
            });
          } finally {
            setIsConnecting(false);
          }
        },
        onError: (error: Error) => {
          // Check if this is a user cancellation
          if (error.name === "AuthCanceled") {
            console.log("User canceled the authentication flow");
            setIsConnecting(false);
            // Don't show error toast for user cancellations
            return;
          }

          console.error("Error connecting provider:", error);
          setIsConnecting(false);
          toast({
            title: "Connection failed",
            description:
              error instanceof Error
                ? error.message
                : "Failed to establish connection",
            variant: "destructive",
          });
        },
      });
    } catch (error) {
      console.error("Error initiating connection:", error);
      setIsConnecting(false);
      toast({
        title: "Connection failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to initiate connection",
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    onCancel();
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md border-gray-100 dark:border-gray-800 shadow-lg">
        <DialogHeader>
          <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 flex items-center justify-center p-2">
              <Image
                src={provider.icon}
                alt={`${provider.name} logo`}
                width={24}
                height={24}
                className="object-contain w-full h-full"
              />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg font-semibold">
                Connect to{" "}
                <span className="bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
                  {provider.name}
                </span>
              </DialogTitle>
            </div>
          </div>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-gray-500 mb-4">
            You'll be redirected to {provider.name} to authorize access to your
            account. This gives the assistant the ability to:
          </p>
          <ul className="list-disc pl-6 text-sm text-gray-500 space-y-2">
            <li>View and manage your calendar events</li>
            <li>Access your contacts</li>
            <li>Create and modify documents on your behalf</li>
          </ul>
        </div>
        <DialogFooter className="flex space-x-2">
          <Button
            variant="outline"
            onClick={handleClose}
            className="border-gray-200 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConnect}
            className="flex-shrink-0 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-sm"
          >
            Connect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
