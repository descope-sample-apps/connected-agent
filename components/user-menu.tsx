"use client";

import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, User, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import {
  connectToOAuthProvider,
  disconnectOAuthProvider,
  handleOAuthPopup,
} from "@/lib/oauth-utils";
import {
  getAllConnectionStatuses,
  OAuthProvider,
  setConnected,
} from "@/lib/connection-manager";

interface UserMenuProps {
  onProfileClick?: (tab?: string) => void;
}

interface Connection {
  id: string;
  name: string;
  icon: string;
  connected: boolean;
}

export default function UserMenu({ onProfileClick }: UserMenuProps) {
  const { user, signOut } = useAuth();
  const [connections, setConnections] = useState<Connection[]>([
    {
      id: "google-calendar",
      name: "Google Calendar",
      icon: "/logos/google-calendar.png",
      connected: false,
    },
    // {
    //   id: "google-docs",
    //   name: "Google Docs",
    //   icon: "/logos/google-docs.png",
    //   connected: false,
    // },
    {
      id: "google-meet",
      name: "Google Meet",
      icon: "/logos/google-meet-logo.png",
      connected: false,
    },
    {
      id: "custom-crm",
      name: "CRM",
      icon: "/logos/crm-logo.png",
      connected: false,
    },
    {
      id: "slack",
      name: "Slack",
      icon: "/logos/slack-logo.svg",
      connected: false,
    },
    {
      id: "linkedin",
      name: "LinkedIn",
      icon: "/logos/linkedin-logo.png",
      connected: false,
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState<string | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState<string | null>(null);

  useEffect(() => {
    fetchConnections();
  }, []);

  const fetchConnections = async () => {
    try {
      setIsLoading(true);

      const response = await fetch("/api/oauth/connections", {
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch connections");
      }

      const data = await response.json();

      if (!data.connections) {
        throw new Error("No connections data found");
      }

      setConnections((prev) =>
        prev.map((connection) => ({
          ...connection,
          connected: data.connections[connection.id]?.connected || false,
        }))
      );
    } catch (error) {
      console.error("Error fetching connections:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnectClick = async (providerId: string) => {
    try {
      setIsConnecting(providerId);

      // Simple redirect URL (no need for redirectTo param as we'll handle it in the popup)
      const redirectUrl = `${window.location.origin}/api/oauth/callback`;

      // Handle connection
      const authUrl = await connectToOAuthProvider({
        appId: providerId,
        redirectUrl,
        state: {
          originalUrl: window.location.href,
        },
      });

      // Handle the OAuth popup
      await handleOAuthPopup(authUrl, {
        onSuccess: () => {
          // Update localStorage immediately
          setConnected(providerId as OAuthProvider, true);

          // Refresh connections immediately
          fetchConnections().then(() => {
            toast({
              title: "Connected",
              description: `Successfully connected to ${
                connections.find((c) => c.id === providerId)?.name || providerId
              }`,
            });
          });
        },
        onError: (error) => {
          // Don't show errors for user cancellation
          if (
            error instanceof Error &&
            (error.name === "AuthCanceled" ||
              error.message === "Authentication window was closed")
          ) {
            console.log("User canceled authentication, not showing error");
          } else {
            toast({
              title: "Error",
              description:
                error instanceof Error
                  ? error.message
                  : "Failed to connect service",
              variant: "destructive",
            });
          }
        },
      });
    } catch (error) {
      console.error("Error connecting provider:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to connect service",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(null);
    }
  };

  const handleDisconnectClick = async (providerId: string) => {
    try {
      setIsDisconnecting(providerId);

      // Immediately update localStorage
      setConnected(providerId as OAuthProvider, false);

      // Immediately mark as disconnected in the UI for better UX
      setConnections((prev) =>
        prev.map((connection) =>
          connection.id === providerId
            ? { ...connection, connected: false }
            : connection
        )
      );

      // Call the disconnection function
      const success = await disconnectOAuthProvider({ providerId });

      if (success) {
        console.log(`Successfully disconnected ${providerId}`);

        // Fetch the latest connection status with a delay to ensure Descope has time to update
        setTimeout(async () => {
          await fetchConnections();
          toast({
            title: "Disconnected",
            description: `Successfully disconnected from ${
              connections.find((c) => c.id === providerId)?.name || providerId
            }`,
          });
        }, 500);
      } else {
        throw new Error("Failed to disconnect provider");
      }
    } catch (error) {
      console.error("Error disconnecting provider:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to disconnect service",
        variant: "destructive",
      });

      // Still refresh connections to get the real status
      await fetchConnections();
    } finally {
      setIsDisconnecting(null);
    }
  };

  // Get icon based on connection type
  const getIcon = (connection: Connection) => {
    if (connection.icon.endsWith(".svg")) {
      return (
        <img
          src={connection.icon}
          alt={connection.name}
          className="w-5 h-5 object-contain"
        />
      );
    }
    return (
      <img
        src={connection.icon}
        alt={connection.name}
        className="w-5 h-5 object-contain"
      />
    );
  };

  if (!user) return null;

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar className="h-10 w-10">
            <AvatarImage src={user.picture} alt={user.name} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.name}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <div className="px-2 py-1.5">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-medium bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
              CONNECTED SERVICES
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
              onClick={fetchConnections}
              disabled={isLoading}
            >
              <RefreshCw
                className={`h-3 w-3 text-muted-foreground ${
                  isLoading ? "animate-spin" : ""
                }`}
              />
            </Button>
          </div>
          <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              connections.map((connection) => (
                <div
                  key={connection.id}
                  className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-accent/50 hover:text-accent-foreground cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 relative flex items-center justify-center">
                      {getIcon(connection)}
                    </div>
                    <span className="text-sm">{connection.name}</span>
                  </div>
                  {isConnecting === connection.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : isDisconnecting === connection.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : connection.connected ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 border border-red-200 dark:border-red-800"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDisconnectClick(connection.id);
                      }}
                    >
                      Disconnect
                    </Button>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-xs px-1 py-0 h-5 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleConnectClick(connection.id);
                      }}
                    >
                      Connect
                    </Badge>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            if (onProfileClick) onProfileClick();
          }}
        >
          <User className="mr-2 h-4 w-4" />
          <span>Profile</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            if (onProfileClick) onProfileClick("connections");
          }}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          <span>Connections</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
