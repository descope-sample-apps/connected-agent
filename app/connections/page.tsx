"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  RefreshCw,
  Check,
  X,
  Clock,
  InfoIcon,
  Loader2,
} from "lucide-react";
import {
  connectToOAuthProvider,
  handleOAuthPopup,
  disconnectOAuthProvider,
  DEFAULT_SCOPES,
} from "@/lib/oauth-utils";
import {
  setConnected,
  getAllConnectionStatuses,
  OAuthProvider as ConnectionProvider,
} from "@/lib/connection-manager";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSession } from "@descope/nextjs-sdk/client";

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

export default function ConnectionsPage() {
  const { user } = useAuth();
  const { isAuthenticated } = useSession();
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
  const fetchConnections = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/oauth/connections`, {
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch connections: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      if (!data.connections) {
        throw new Error("No connections data in response");
      }

      // Update providers with API connection data
      setOauthProviders((providers) =>
        providers.map((provider) => {
          const connectionData = data.connections[provider.id];

          // Return object with complete data
          if (connectionData?.token) {
            return {
              ...provider,
              connected: connectionData.connected === true,
              tokenData: {
                scopes: connectionData.token.scopes || [],
                accessToken: connectionData.token.accessToken || "",
                expiresAt: connectionData.token.accessTokenExpiry || "",
              },
            };
          }

          return {
            ...provider,
            connected: connectionData?.connected === true,
          };
        })
      );
    } catch (error) {
      console.error("Error fetching connections:", error);
      setError(
        error instanceof Error ? error.message : "Failed to fetch connections"
      );
      // On error, still use localStorage values
      const localConnectionStatuses = getAllConnectionStatuses();
      setOauthProviders((providers) =>
        providers.map((provider) => ({
          ...provider,
          connected:
            localConnectionStatuses[provider.id as ConnectionProvider] || false,
        }))
      );

      toast({
        title: "Connection Status",
        description:
          "Using locally stored connection status. Server verification failed.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!isAuthenticated) {
      console.log("Not authenticated, redirecting to login");
      router.push("/login?redirectTo=connections");
      return;
    }

    // Only fetch connections if authenticated
    if (isAuthenticated) {
      fetchConnections();
    }
  }, [isAuthenticated, router, fetchConnections]);

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
        });

        if (success) {
          // Refresh connections first to get the latest status
          await fetchConnections();

          toast({
            title: "Disconnected",
            description: `Successfully disconnected from ${providerObj.name}`,
          });

          // Update the connection status after refreshing
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
        const redirectUrl = `${window.location.origin}/api/oauth/callback?redirectTo=connections`;

        const authUrl = await connectToOAuthProvider({
          appId: provider,
          redirectUrl,
          state: {
            redirectTo: "connections",
          },
        });

        await handleOAuthPopup(authUrl, {
          onSuccess: async () => {
            console.log("OAuth success, verifying connection status");

            try {
              // Refresh connections to get the latest status
              await fetchConnections();

              // Fetch updated connection data to verify the connection
              const response = await fetch(`/api/oauth/connections`, {
                headers: {
                  "Cache-Control": "no-cache",
                  Pragma: "no-cache",
                },
                cache: "no-store",
              });

              if (!response.ok) {
                throw new Error("Failed to verify connection status");
              }

              const data = await response.json();

              if (data.connections && data.connections[provider]) {
                const connectionData = data.connections[provider];

                // Check if the connection was actually successful
                if (!connectionData.connected) {
                  throw new Error("Connection was not established");
                }

                console.log(tokenData.accessTokenExpiry);

                const tokenData = connectionData.token || {};

                // Update connection status in UI
                setOauthProviders((prevProviders) =>
                  prevProviders.map((p) =>
                    p.id === provider
                      ? {
                          ...p,
                          connected: true,
                          tokenData: {
                            scopes: tokenData.scopes || [],
                            accessToken: tokenData.accessToken || "",
                            expiresAt: tokenData.accessTokenExpiry || "",
                          },
                        }
                      : p
                  )
                );

                // Update global connection status
                setConnected(provider as ConnectionProvider, true);

                toast({
                  title: "Connected",
                  description: `Successfully connected to ${providerObj.name}`,
                });
              } else {
                throw new Error("Connection data not found for provider");
              }
            } catch (error) {
              console.error("Error verifying connection:", error);

              // Refresh connections again to ensure UI is in sync
              await fetchConnections();

              // Ensure UI shows correct connection state
              setOauthProviders((prevProviders) =>
                prevProviders.map((p) =>
                  p.id === provider
                    ? { ...p, connected: false, tokenData: undefined }
                    : p
                )
              );

              toast({
                title: "Connection Failed",
                description:
                  error instanceof Error
                    ? error.message
                    : "Failed to establish connection",
                variant: "destructive",
              });
            }
          },
          onError: (error) => {
            console.error("OAuth error:", error);
            // Refresh connections to ensure UI is in sync
            fetchConnections();

            toast({
              title: "Connection Failed",
              description: error.message || "Failed to connect",
              variant: "destructive",
            });
          },
          onClose: () => {
            // Refresh connections whenever the popup closes
            console.log("OAuth popup closed, refreshing connections");
            fetchConnections();
          },
        });
      }
    } catch (error) {
      console.error("Error connecting provider:", error);
      // Refresh connections to ensure UI is in sync
      fetchConnections();

      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
      setError(
        error instanceof Error ? error.message : "Failed to connect provider"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const resetAllConnections = () => {
    try {
      setIsLoading(true);
      setError(null);

      // Force reset all providers to disconnected state
      setOauthProviders((providers) =>
        providers.map((provider) => ({
          ...provider,
          connected: false,
          tokenData: undefined,
          lastSync: null,
        }))
      );

      // Show success message
      toast({
        title: "Reset Complete",
        description:
          "All connection states have been reset. Please reconnect any services you need.",
      });

      // After a short delay, refresh connections from the server
      setTimeout(async () => {
        await fetchConnections();
        setIsLoading(false);
      }, 500);
    } catch (error) {
      console.error("Error resetting connections:", error);
      setIsLoading(false);
      toast({
        title: "Error",
        description: "Failed to reset connections. Please try again.",
        variant: "destructive",
      });
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
    try {
      if (!expiryTimestamp) return "Unknown";

      const expiry = new Date(expiryTimestamp);

      // Check if the date is valid
      if (isNaN(expiry.getTime())) {
        return "Invalid date";
      }

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
    } catch (error) {
      console.error("Error formatting token expiry:", error, expiryTimestamp);
      return "Unknown";
    }
  }

  function getAbsoluteExpiryTime(expiryTimestamp: string): string {
    try {
      if (!expiryTimestamp) return "Unknown";

      const date = new Date(expiryTimestamp);

      // Check if the date is valid
      if (isNaN(date.getTime())) {
        return "Invalid date format";
      }

      return date.toLocaleString();
    } catch (error) {
      console.error(
        "Error formatting absolute expiry time:",
        error,
        expiryTimestamp
      );
      return "Unknown";
    }
  }

  // Add loading skeleton component
  function ConnectionsSkeleton() {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="h-7 w-48 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
            <div className="h-5 w-72 bg-gray-200 dark:bg-gray-800 rounded animate-pulse mt-2" />
          </CardHeader>
          <CardContent className="space-y-6">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between py-4 border-b border-gray-100 dark:border-gray-800 last:border-0"
              >
                <div className="flex items-center">
                  <div className="w-8 h-8 mr-3 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                  <div>
                    <div className="h-5 w-32 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                    <div className="h-4 w-24 bg-gray-200 dark:bg-gray-800 rounded animate-pulse mt-2" />
                  </div>
                </div>
                <div className="h-8 w-20 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  function LoadingSpinner() {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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
          onClick={() => router.push("/")}
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
        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <>
            <Card className="border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-all">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-semibold bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
                    Connected Services
                  </CardTitle>
                  <CardDescription>
                    Manage your connected services and outbound app permissions
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {oauthProviders.map((provider) => (
                  <div
                    key={provider.id}
                    className="flex items-center justify-between py-4 border-b border-gray-100 dark:border-gray-800 last:border-0"
                  >
                    <div className="flex items-center">
                      <div className="w-10 h-10 mr-3 flex-shrink-0 bg-gray-50 dark:bg-gray-900 p-1.5 rounded-full ring-1 ring-gray-200 dark:ring-gray-800">
                        <img
                          src={provider.icon}
                          alt={provider.name}
                          className="w-full h-full"
                        />
                      </div>
                      <div>
                        <div className="font-medium">{provider.name}</div>
                        <div className="text-sm text-gray-500">
                          {provider.connected ? "Connected" : "Not connected"}
                        </div>
                      </div>
                    </div>
                    {provider.connected ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleConnection(provider.id)}
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                            Disconnecting...
                          </>
                        ) : (
                          "Disconnect"
                        )}
                      </Button>
                    ) : (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => toggleConnection(provider.id)}
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                            Connecting...
                          </>
                        ) : (
                          "Connect"
                        )}
                      </Button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="w-full card-hover mt-6">
              <CardHeader>
                <CardTitle>Data Access</CardTitle>
                <CardDescription>
                  Review what the AI assistant can access through your connected
                  services
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {oauthProviders.map((provider) => {
                    // Get the required scopes for this provider
                    const requiredScopes =
                      DEFAULT_SCOPES[provider.id as ConnectionProvider] || [];
                    // Get the granted scopes for this provider (if connected)
                    const grantedScopes =
                      provider.connected && provider.tokenData?.scopes
                        ? provider.tokenData.scopes
                        : [];

                    return (
                      <div
                        key={provider.id}
                        className="space-y-3 p-4 border rounded-md bg-card animate-scaleIn"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 flex-shrink-0 bg-gray-50 dark:bg-gray-900 p-1 rounded-full ring-1 ring-gray-200 dark:ring-gray-800">
                            <img
                              src={provider.icon}
                              alt={provider.name}
                              className="w-full h-full"
                            />
                          </div>
                          <h3 className="font-medium">{provider.name}</h3>
                          <Badge
                            variant={
                              provider.connected ? "default" : "secondary"
                            }
                            className="ml-auto"
                          >
                            {provider.connected ? "Connected" : "Not Connected"}
                          </Badge>
                        </div>

                        {provider.connected ? (
                          <div className="pl-2 pt-2 text-sm">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <p className="font-medium mb-1 flex items-center text-primary">
                                  <Check className="mr-2 h-4 w-4" />
                                  Granted Permissions:
                                </p>
                                {grantedScopes.length > 0 ? (
                                  <ul className="space-y-1.5">
                                    {grantedScopes.map((scope) => (
                                      <li
                                        key={scope}
                                        className="flex items-start"
                                      >
                                        <Badge
                                          variant="outline"
                                          className="mr-2 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-900"
                                        >
                                          <Check className="mr-1 h-3 w-3 text-green-600 dark:text-green-400" />
                                        </Badge>
                                        {formatScope(scope)}
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-muted-foreground italic">
                                    No permissions granted
                                  </p>
                                )}

                                {/* Token expiry information */}
                                {provider.tokenData?.expiresAt && (
                                  <div className="mt-3 pt-3 border-t border-dashed border-gray-200 dark:border-gray-800">
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <p className="text-sm flex items-center text-muted-foreground cursor-help">
                                            <Clock className="mr-2 h-3.5 w-3.5" />
                                            Token expires:{" "}
                                            {formatTokenExpiry(
                                              provider.tokenData.expiresAt
                                            )}
                                          </p>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>
                                            Expires on:{" "}
                                            {getAbsoluteExpiryTime(
                                              provider.tokenData.expiresAt
                                            )}
                                          </p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </div>
                                )}
                              </div>

                              <div className="space-y-2">
                                <p className="font-medium mb-1 flex items-center text-muted-foreground">
                                  <InfoIcon className="mr-2 h-4 w-4" />
                                  Required Permissions:
                                </p>
                                {requiredScopes.length > 0 ? (
                                  <ul className="space-y-1.5">
                                    {requiredScopes.map((scope) => {
                                      const isGranted =
                                        grantedScopes.includes(scope);
                                      return (
                                        <li
                                          key={scope}
                                          className="flex items-start"
                                        >
                                          <Badge
                                            variant="outline"
                                            className={`mr-2 ${
                                              isGranted
                                                ? "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-900"
                                                : "bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-900"
                                            }`}
                                          >
                                            {isGranted ? (
                                              <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                                            ) : (
                                              <X className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                                            )}
                                          </Badge>
                                          {formatScope(scope)}
                                        </li>
                                      );
                                    })}
                                  </ul>
                                ) : (
                                  <p className="text-muted-foreground italic">
                                    No permissions required
                                  </p>
                                )}
                              </div>
                            </div>

                            {!requiredScopes.every((scope) =>
                              grantedScopes.includes(scope)
                            ) && (
                              <div className="mt-4 pt-3 border-t border-dashed">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full"
                                  onClick={() => toggleConnection(provider.id)}
                                >
                                  <RefreshCw className="mr-2 h-3.5 w-3.5" />
                                  Update Permissions
                                </Button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="pl-2 pt-2 text-sm">
                            <p className="text-muted-foreground">
                              Connect this service to view available permissions
                            </p>
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-2"
                              onClick={() => toggleConnection(provider.id)}
                            >
                              Connect {provider.name}
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
      <div className="p-4 border-t">
        <Button
          variant="outline"
          className="w-full"
          onClick={() => router.push("/")}
        >
          Back to Chat
        </Button>
      </div>
    </div>
  );
}
