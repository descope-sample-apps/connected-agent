import { useState } from "react";
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
}

export function ConnectionNotification({
  provider,
  onSuccess,
  onCancel,
}: ConnectionNotificationProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    try {
      setIsConnecting(true);

      // Construct redirect URL back to the current page
      const redirectUrl = `${
        window.location.origin
      }/api/oauth/callback?redirectTo=${encodeURIComponent(
        window.location.pathname
      )}`;

      // Get the authorization URL
      const url = await connectToOAuthProvider({
        appId: provider.id,
        redirectUrl,
        scopes: provider.scopes,
      });

      // Handle the OAuth popup
      handleOAuthPopup(url, {
        onSuccess: async () => {
          try {
            // Verify the connection was successful
            const response = await fetch("/api/oauth/connections");
            if (!response.ok) {
              throw new Error("Failed to verify connection status");
            }

            const data = await response.json();
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
          } catch (error: unknown) {
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 flex-shrink-0">
              <Image
                src={provider.icon}
                alt={provider.name}
                width={48}
                height={48}
                className="rounded-md"
              />
            </div>
            <div>
              <DialogTitle>Connect to {provider.name}</DialogTitle>
              <DialogDescription>
                The assistant needs access to {provider.name} to complete your
                request
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-4">
            Connecting to {provider.name} will allow the assistant to:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-sm">
            {provider.id === "google-calendar" && (
              <>
                <li>View and manage your calendar events</li>
                <li>Schedule meetings on your behalf</li>
                <li>Check your availability</li>
              </>
            )}
            {provider.id === "google-docs" && (
              <>
                <li>Create and edit documents</li>
                <li>Read content from your documents</li>
                <li>Share documents with others</li>
              </>
            )}
            {provider.id === "zoom" && (
              <>
                <li>Create Zoom meetings</li>
                <li>Manage meeting settings</li>
                <li>View your scheduled meetings</li>
              </>
            )}
            {provider.id === "crm" && (
              <>
                <li>View your customer data</li>
                <li>Access deal information</li>
                <li>Update contact records</li>
              </>
            )}
            {provider.id === "custom-crm" && (
              <>
                <li>Access customer contact information</li>
                <li>View and update deal statuses</li>
                <li>Create new leads and opportunities</li>
              </>
            )}
          </ul>
        </div>

        <DialogFooter className="flex sm:justify-between">
          <Button variant="ghost" onClick={handleClose} disabled={isConnecting}>
            Not now
          </Button>
          <Button onClick={handleConnect} disabled={isConnecting}>
            {isConnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Connect to {provider.name}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
