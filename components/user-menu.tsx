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
import {
  LogOut,
  User,
  ExternalLink,
  Calendar,
  FileText,
  Video,
  Database,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useEffect, useState } from "react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import { connectToOAuthProvider, handleOAuthPopup } from "@/lib/oauth-utils";

interface UserMenuProps {
  onProfileClick?: () => void;
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
    {
      id: "google-docs",
      name: "Google Docs",
      icon: "/logos/google-docs.png",
      connected: false,
    },
    {
      id: "zoom",
      name: "Zoom",
      icon: "/logos/zoom-logo.png",
      connected: false,
    },
    {
      id: "custom-crm",
      name: "CRM",
      icon: "/logos/crm-logo.png",
      connected: false,
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState<string | null>(null);

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

  const handleConnectClick = async (connectionId: string) => {
    try {
      setIsConnecting(connectionId);

      // Get redirect URL
      const redirectUrl = `${window.location.origin}/api/oauth/callback?redirectTo=currentPage`;

      // Get authorization URL
      const authUrl = await connectToOAuthProvider({
        appId: connectionId,
        redirectUrl,
        state: {
          originalUrl: window.location.href,
        },
      });

      // Handle the OAuth popup
      await handleOAuthPopup(authUrl, {
        onSuccess: () => {
          fetchConnections();
          toast({
            title: "Connected successfully",
            description: `Successfully connected to ${
              connections.find((c) => c.id === connectionId)?.name
            }`,
          });
        },
        onError: (error) => {
          toast({
            title: "Connection failed",
            description: error.message || "Failed to connect",
            variant: "destructive",
          });
        },
      });
    } catch (error) {
      console.error("Error connecting:", error);
      toast({
        title: "Connection failed",
        description:
          error instanceof Error ? error.message : "Failed to connect",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(null);
    }
  };

  // Get icon based on connection type
  const getIcon = (connection: Connection) => {
    switch (connection.id) {
      case "google-calendar":
        return <Calendar className="h-4 w-4 text-indigo-500" />;
      case "google-docs":
        return <FileText className="h-4 w-4 text-purple-500" />;
      case "zoom":
        return <Video className="h-4 w-4 text-indigo-500" />;
      case "custom-crm":
        return <Database className="h-4 w-4 text-purple-500" />;
      default:
        return <ExternalLink className="h-4 w-4 text-indigo-500" />;
    }
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
                  className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-accent hover:text-accent-foreground cursor-pointer"
                  onClick={() =>
                    !connection.connected && handleConnectClick(connection.id)
                  }
                >
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 relative flex items-center justify-center">
                      {getIcon(connection)}
                    </div>
                    <span className="text-sm">{connection.name}</span>
                  </div>
                  {isConnecting === connection.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Badge
                      variant={connection.connected ? "default" : "outline"}
                      className={`text-xs px-1 py-0 h-5 ${
                        connection.connected
                          ? "bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
                          : ""
                      }`}
                    >
                      {connection.connected ? "Connected" : "Connect"}
                    </Badge>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onProfileClick}>
          <User className="mr-2 h-4 w-4" />
          <span>Profile</span>
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
