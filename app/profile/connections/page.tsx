"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";
import { ChevronLeft, RefreshCw, AlertCircle, Check, X } from "lucide-react";
import Image from "next/image";
import {
  connectToOAuthProvider,
  handleOAuthPopup,
  disconnectOAuthProvider,
  OAuthDisconnectParams,
} from "@/lib/oauth-utils";
import {
  getAllConnectionStatuses,
  setConnected,
  OAuthProvider as ConnectionProviderType,
} from "@/lib/connection-manager";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface OAuthProvider {
  id: string;
  name: string;
  icon: string;
  connected: boolean;
  tokenData?: {
    scopes: string[];
    accessToken: string;
    expiresAt: string;
  };
}

type ConnectionStatuses = Record<string, any>;

export default function ConnectionsPage() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const [oauthProviders, setOauthProviders] = useState<OAuthProvider[]>([
    {
      id: "google-calendar",
      name: "Google Calendar",
      icon: "/logos/google-calendar.png",
      connected: false,
    },
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
  ]);

  // Function to fetch connections
  const fetchConnections = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const statuses = (await getAllConnectionStatuses()) as ConnectionStatuses;

      // Update the oauthProviders with connection status
      setOauthProviders((prevProviders) =>
        prevProviders.map((provider) => ({
          ...provider,
          connected: !!statuses[provider.id],
          tokenData: statuses[provider.id],
        }))
      );
    } catch (error) {
      console.error("Error fetching connections:", error);
      setError("Failed to fetch connection statuses");
      toast({
        title: "Error",
        description: "Failed to load connections",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch connections on mount
  useEffect(() => {
    fetchConnections();
  }, []);

  // Handle toggling a connection
  const toggleConnection = async (provider: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const providerObj = oauthProviders.find((p) => p.id === provider);
      if (!providerObj) return;

      if (providerObj.connected) {
        // Disconnect
        const success = await disconnectOAuthProvider({
          providerId: provider,
        } as OAuthDisconnectParams);
        if (success) {
          toast({
            title: "Disconnected",
            description: `Successfully disconnected from ${providerObj.name}`,
          });

          // Update the connection status
          setOauthProviders((prevProviders) =>
            prevProviders.map((p) =>
              p.id === provider
                ? { ...p, connected: false, tokenData: undefined }
                : p
            )
          );
        } else {
          throw new Error("Failed to disconnect");
        }
      } else {
        // Connect
        const redirectUrl = `${window.location.origin}/api/oauth/callback?redirectTo=profile/connections`;

        const authUrl = await connectToOAuthProvider({
          appId: provider,
          redirectUrl,
          state: {
            redirectTo: "profile/connections",
          },
        });

        await handleOAuthPopup(authUrl, {
          onSuccess: (tokenData: any) => {
            toast({
              title: "Connected",
              description: `Successfully connected to ${providerObj.name}`,
            });

            // Update connection status
            setOauthProviders((prevProviders) =>
              prevProviders.map((p) =>
                p.id === provider ? { ...p, connected: true, tokenData } : p
              )
            );

            // Update global connection status
            setConnected(provider as ConnectionProviderType, tokenData);
          },
          onError: (error) => {
            toast({
              title: "Connection Failed",
              description: error.message || "Failed to connect",
              variant: "destructive",
            });
          },
        });
      }
    } catch (error) {
      console.error("Error toggling connection:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Connection operation failed",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Format scope name for display
  function formatScope(scope: string): string {
    return scope
      .replace(/\./g, " ")
      .replace(/^https:\/\/www\.googleapis\.com\/auth\//, "")
      .split(".")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(".");
  }

  // Format token expiry time
  function formatTokenExpiry(expiryTimestamp: string): string {
    const expiry = new Date(expiryTimestamp);
    const now = new Date();

    // Check if the token is expired
    if (expiry < now) {
      return "Expired";
    }

    // Calculate difference in minutes
    const diffMs = expiry.getTime() - now.getTime();
    const diffMins = Math.round(diffMs / 60000);

    if (diffMins < 60) {
      return `Expires in ${diffMins} minute${diffMins !== 1 ? "s" : ""}`;
    }

    const hours = Math.floor(diffMins / 60);
    if (hours < 24) {
      return `Expires in ${hours} hour${hours !== 1 ? "s" : ""}`;
    }

    const days = Math.floor(hours / 24);
    return `Expires in ${days} day${days !== 1 ? "s" : ""}`;
  }

  function ConnectionsSkeleton() {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex items-center justify-between p-4 border rounded-lg"
          >
            <div className="flex items-center space-x-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="h-4 w-[150px]" />
            </div>
            <Skeleton className="h-8 w-[100px]" />
          </div>
        ))}
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <p className="text-muted-foreground">
          Please sign in to view your connections
        </p>
        <Button
          onClick={() => router.push("/login")}
          variant="outline"
          className="mt-4"
        >
          Sign In
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      <div className="flex items-center p-4 border-b">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/profile")}
          className="mr-2"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-lg font-semibold">Connection Settings</h2>
        <div className="ml-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchConnections}
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="flex items-center">
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Refreshing...
              </span>
            ) : (
              <span className="flex items-center">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </span>
            )}
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <Card>
          <CardContent className="pt-6">
            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-md flex items-center">
                <AlertCircle className="h-4 w-4 mr-2" />
                {error}
              </div>
            )}

            {isLoading ? (
              <ConnectionsSkeleton />
            ) : (
              <div className="space-y-4">
                {oauthProviders.map((provider) => (
                  <div
                    key={provider.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 relative">
                        <Image
                          src={provider.icon}
                          alt={provider.name}
                          fill
                          className="object-contain"
                        />
                      </div>
                      <div>
                        <h3 className="font-medium">{provider.name}</h3>
                        {provider.connected && provider.tokenData && (
                          <p className="text-xs text-muted-foreground">
                            {formatTokenExpiry(provider.tokenData.expiresAt)}
                          </p>
                        )}
                      </div>
                    </div>

                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant={provider.connected ? "outline" : "default"}
                            size="sm"
                            onClick={() => toggleConnection(provider.id)}
                            disabled={isLoading}
                            className={
                              provider.connected
                                ? "text-red-500 hover:text-red-600"
                                : ""
                            }
                          >
                            {provider.connected ? (
                              <span className="flex items-center">
                                <X className="h-4 w-4 mr-2" />
                                Disconnect
                              </span>
                            ) : (
                              <span className="flex items-center">
                                <Check className="h-4 w-4 mr-2" />
                                Connect
                              </span>
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {provider.connected
                            ? `Disconnect from ${provider.name}`
                            : `Connect to ${provider.name}`}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
