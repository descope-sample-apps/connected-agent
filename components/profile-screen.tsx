"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Check,
  ExternalLink,
  LogOut,
  Mail,
  RefreshCw,
  X,
  MessageSquare,
  Clock,
  Star,
  MoreHorizontal,
  Share2,
  Trash2,
  Loader2,
  AlertCircle,
  Share,
  Trash,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { connectToOAuthProvider } from "@/lib/oauth-utils";
import { handleOAuthPopup } from "@/lib/oauth-utils";
import Image from "next/image";
import { UserProfile } from "@descope/nextjs-sdk";
import { toast } from "@/components/ui/use-toast";
import { getUserChats, getRecentChatsWithLastMessage } from "@/lib/db/queries";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useTheme } from "next-themes";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { availableModels } from "@/lib/ai/providers";
import { useEffect as useClientEffect } from "react";
import { disconnectOAuthProvider } from "@/lib/oauth-utils";

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

interface ChatHistory {
  id: string;
  title: string;
  preview: string;
  date: string;
  starred: boolean;
  shared: boolean;
}

interface CalendarEvent {
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  attendees: string[];
  location?: string;
  timeZone?: string;
  recurrence?: string[];
  reminders?: {
    method: string;
    minutes: number;
  }[];
}

interface ScheduleMeetingResponse {
  calendarEventId: string;
  zoomMeetingId?: string;
  message?: string;
  needsInput?: {
    field: string;
    message: string;
    currentValue?: string;
  };
}

interface OAuthTokenData {
  scopes: string[];
  accessToken: string;
  expiresAt: string;
}

interface OAuthPopupCallbacks {
  onSuccess: (tokenData: OAuthTokenData) => void;
  onError: (error: Error) => void;
}

export default function ProfileScreen({
  onBack,
  onLoadChat,
}: {
  onBack: () => void;
  onLoadChat: (chatId: string) => void;
}) {
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState("profile");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [oauthProviders, setOauthProviders] = useState<OAuthProvider[]>([
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

  // Replace the mock data with a function to fetch real chat history
  const [chatHistory, setChatHistory] = useState<ChatHistory[]>([]);
  const [isLoadingChats, setIsLoadingChats] = useState<boolean>(false);
  const [chatError, setChatError] = useState<string | null>(null);

  // Function to fetch actual chat history
  const fetchChatHistory = async () => {
    try {
      setIsLoadingChats(true);
      setChatError(null);

      // Get the user's chats with latest messages
      const response = await fetch("/api/chats", {
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch chat history");
      }

      const data = await response.json();

      // Transform the data to match our ChatHistory interface
      const formattedChats = data.chats.map((item: any) => ({
        id: item.chat.id,
        title: item.chat.title || "Untitled Chat",
        preview: item.lastMessage
          ? typeof item.lastMessage.parts[0] === "string"
            ? item.lastMessage.parts[0].substring(0, 100)
            : "Chat content"
          : "No messages",
        date: item.chat.lastMessageAt
          ? new Date(item.chat.lastMessageAt).toLocaleString()
          : new Date(item.chat.createdAt).toLocaleString(),
        starred: false, // We can add this feature later
        shared: false, // We can add this feature later
      }));

      setChatHistory(formattedChats);
    } catch (error) {
      console.error("Error fetching chat history:", error);
      setChatError(
        error instanceof Error ? error.message : "Failed to load chat history"
      );
    } finally {
      setIsLoadingChats(false);
    }
  };

  // Fetch connections and chat history on component mount and after connections change
  useEffect(() => {
    fetchConnections();
    fetchChatHistory();
  }, []);

  // Refresh chat history after a successful connection
  const handleConnectionSuccess = async (providerId: string) => {
    try {
      // First refresh connections to get updated status
      await fetchConnections();

      // Then refresh chat history
      await fetchChatHistory();

      // Show success toast
      toast({
        title: "Connection Successful",
        description: `Successfully connected to ${providerId.replace(
          "-",
          " "
        )}`,
      });
    } catch (error) {
      console.error("Error refreshing after connection:", error);
      toast({
        title: "Error",
        description: "Failed to refresh data after connection",
        variant: "destructive",
      });
    }
  };

  const fetchConnections = async () => {
    try {
      const response = await fetch("/api/oauth/connections", {
        // Add cache-busting parameter
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
        // Generate a unique timestamp to prevent caching
        cache: "no-store",
      });

      // Log the full response details
      console.log("Response status:", response.status);
      console.log(
        "Response headers:",
        Object.fromEntries([...response.headers.entries()])
      );
      console.log("Response type:", response.type);

      if (!response.ok) {
        throw new Error("Failed to fetch connections");
      }

      const data = await response.json();
      if (!data.connections) {
        throw new Error("No connections data in response");
      }

      // Add debug logging
      console.log("Received connections data:", data.connections);

      // Update the providers with connection data
      setOauthProviders((providers) =>
        providers.map((provider) => {
          const connectionData = data.connections[provider.id];
          if (!connectionData) {
            return { ...provider, connected: false };
          }

          if (typeof connectionData === "object" && "error" in connectionData) {
            console.error(
              `Connection error for ${provider.id}:`,
              connectionData.error
            );
            return { ...provider, connected: false };
          }

          // Check for the connected property from the API
          if (!connectionData.connected) {
            return { ...provider, connected: false };
          }

          // Use the token property from the connection data
          // which contains all the necessary token information
          return {
            ...provider,
            connected: true,
            tokenData: connectionData.token
              ? {
                  scopes: connectionData.token.scopes || [],
                  accessToken: connectionData.token.accessToken || "",
                  expiresAt: connectionData.token.accessTokenExpiry || "",
                }
              : undefined,
          };
        })
      );
    } catch (error) {
      console.error("Error fetching connections:", error);
      setError(
        error instanceof Error ? error.message : "Failed to fetch connections"
      );
    }
  };

  if (!user) return null;

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  const toggleConnection = async (provider: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const providerData = oauthProviders.find((p) => p.id === provider);
      if (!providerData) {
        throw new Error("Provider not found");
      }

      // Only handle connection, disconnection is handled by disconnectProvider
      if (!providerData.connected) {
        // Get the current chat ID from localStorage
        const currentChatId = localStorage.getItem("currentChatId");

        // Construct the redirect URL with the chat ID if available
        const redirectUrl = `${
          window.location.origin
        }/api/oauth/callback?redirectTo=chat${
          currentChatId ? `&chatId=${currentChatId}` : ""
        }`;

        // Handle connection
        const authUrl = await connectToOAuthProvider({
          appId: provider,
          redirectUrl,
        });

        // Handle the OAuth popup
        await handleOAuthPopup(authUrl, {
          onSuccess: () => {
            // Update the provider's connection status
            setOauthProviders((providers) =>
              providers.map((p) =>
                p.id === provider
                  ? {
                      ...p,
                      connected: true,
                    }
                  : p
              )
            );

            toast({
              title: "Connected",
              description: `Successfully connected to ${providerData.name}`,
            });

            // Refresh chat history after successful connection
            handleConnectionSuccess(provider);
          },
          onError: (error) => {
            throw new Error(error.message || "Failed to connect");
          },
        });
      }
    } catch (error) {
      console.error("Error connecting:", error);
      setError(
        error instanceof Error ? error.message : "Failed to connect service"
      );
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to connect service",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const refreshConnection = (providerId: string) => {
    setIsLoading(true);

    // In a real app, this would refresh the OAuth token via Descope
    setTimeout(() => {
      setOauthProviders((providers) =>
        providers.map((provider) =>
          provider.id === providerId
            ? { ...provider, lastSync: "Just now" }
            : provider
        )
      );
      setIsLoading(false);
    }, 1000);
  };

  const toggleStarChat = (chatId: string) => {
    setChatHistory((chats) =>
      chats.map((chat) =>
        chat.id === chatId ? { ...chat, starred: !chat.starred } : chat
      )
    );
  };

  const deleteChat = (chatId: string) => {
    setChatHistory((chats) => chats.filter((chat) => chat.id !== chatId));
  };

  const shareChat = (chatId: string) => {
    // In a real app, this would generate a unique URL and handle permissions
    setChatHistory((chats) =>
      chats.map((chat) =>
        chat.id === chatId ? { ...chat, shared: true } : chat
      )
    );

    // Mock share dialog
    alert(
      `Chat shared! Share link: https://crm-assistant.app/shared/${chatId}`
    );
  };

  function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Add helper function to format scope strings
  function formatScope(scope: string): string {
    // Remove URL parts and common prefixes
    const cleanScope = scope
      .replace("https://www.googleapis.com/auth/", "")
      .replace("https://www.googleapis.com/", "")
      .replace(".readonly", " (read only)");

    // Split on dots and underscores, capitalize each word
    return cleanScope
      .split(/[._]/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  // Add a function to handle example clicks
  const handleExampleClick = (example: string) => {
    // In a real app, this would send the example to the chat
    console.log("Example clicked:", example);
  };

  // Add loading skeleton component at the top of the file
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

  // Add a loading spinner component
  function LoadingSpinner() {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <div className="relative">
          <Loader2 className="h-12 w-12 text-primary animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-8 w-8 rounded-full bg-background"></div>
          </div>
        </div>
        <div className="text-center space-y-2">
          <h3 className="text-lg font-medium">Retrieving Connections</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Please wait while we fetch your connected services and
            permissions...
          </p>
        </div>
      </div>
    );
  }

  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>("gpt-3.5-turbo");
  const [sidebarDefault, setSidebarDefault] = useState(true);
  const [autoSaveChats, setAutoSaveChats] = useState(true);

  useClientEffect(() => {
    setMounted(true);

    // Get sidebar preference from cookie/localStorage
    const storedSidebarPref = localStorage.getItem("sidebarDefault");
    if (storedSidebarPref !== null) {
      setSidebarDefault(storedSidebarPref === "true");
    }

    // Get auto-save preference from cookie/localStorage
    const storedAutoSavePref = localStorage.getItem("autoSaveChats");
    if (storedAutoSavePref !== null) {
      setAutoSaveChats(storedAutoSavePref === "true");
    }

    // Get the selected model from cookie
    const storedModel = document.cookie
      .split("; ")
      .find((row) => row.startsWith("chat-model="));

    if (storedModel) {
      setSelectedModel(storedModel.split("=")[1]);
    }
  }, []);

  const handleModelChange = (value: string) => {
    setSelectedModel(value);
    document.cookie = `chat-model=${value}; path=/; max-age=31536000; SameSite=Lax`;
    toast({
      title: "Model Updated",
      description: `Chat model set to ${availableModels[value]?.name || value}`,
    });
  };

  const handleSidebarDefaultChange = (checked: boolean) => {
    setSidebarDefault(checked);
    localStorage.setItem("sidebarDefault", String(checked));
    toast({
      title: "Preference Updated",
      description: `Sidebar will ${checked ? "show" : "hide"} by default`,
    });
  };

  const handleAutoSaveChange = (checked: boolean) => {
    setAutoSaveChats(checked);
    localStorage.setItem("autoSaveChats", String(checked));
    toast({
      title: "Preference Updated",
      description: `Auto-save chats ${checked ? "enabled" : "disabled"}`,
    });
  };

  const disconnectProvider = async (providerId: string) => {
    try {
      setIsLoading(true);

      // Call the disconnect function
      const success = await disconnectOAuthProvider({ providerId });

      if (success) {
        // Refresh connections list
        await fetchConnections();

        toast({
          title: "Disconnected",
          description: `Successfully disconnected from ${providerId.replace(
            "-",
            " "
          )}`,
        });
      } else {
        throw new Error("Failed to disconnect");
      }
    } catch (error) {
      console.error(`Error disconnecting ${providerId}:`, error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to disconnect service",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container max-w-4xl py-6">
      <Button variant="ghost" className="mb-6" onClick={onBack}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Chat
      </Button>

      <div className="flex items-start gap-6 mb-6">
        <Avatar className="h-20 w-20 border-4 border-background">
          <AvatarImage src={user.picture} alt={user.name} />
          <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
        </Avatar>

        <div className="flex-1">
          <h1 className="text-2xl font-bold">{user.name}</h1>
          <p className="text-muted-foreground flex items-center">
            <Mail className="mr-2 h-4 w-4" /> {user.email}
          </p>
        </div>

        <Button variant="outline" onClick={signOut}>
          <LogOut className="mr-2 h-4 w-4" /> Sign Out
        </Button>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="connections">Connections</TabsTrigger>
          <TabsTrigger value="chat-history">Chat History</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Account Settings</CardTitle>
              <CardDescription>
                Manage your account and preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UserProfile
                widgetId="user-profile-widget"
                theme={theme}
                onLogout={() => {
                  signOut();
                  window.location.href = "/login";
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="connections" className="space-y-6">
          {isLoading ? (
            <LoadingSpinner />
          ) : (
            <>
              <Card className="border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-all">
                <CardHeader>
                  <CardTitle className="text-xl font-semibold bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
                    Connected Services
                  </CardTitle>
                  <CardDescription>
                    Manage your connected services and Descope outbound app
                    permissions
                  </CardDescription>
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
                          onClick={() => disconnectProvider(provider.id)}
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

              <Card className="w-full">
                <CardHeader>
                  <CardTitle>Data Access</CardTitle>
                  <CardDescription>
                    Review what the AI assistant can access through your
                    connected services
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {oauthProviders.map((provider) => (
                      <div key={provider.id} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Image
                            src={provider.icon}
                            alt={provider.name}
                            width={24}
                            height={24}
                            className="rounded-sm"
                          />
                          <h3 className="font-medium">{provider.name}</h3>
                          <Badge
                            variant={
                              provider.connected ? "default" : "secondary"
                            }
                          >
                            {provider.connected ? "Connected" : "Not Connected"}
                          </Badge>
                        </div>
                        {provider.connected && provider.tokenData?.scopes && (
                          <div className="pl-8 text-sm text-gray-600 dark:text-gray-400">
                            <p className="font-medium mb-1">
                              Granted Permissions:
                            </p>
                            <ul className="list-disc pl-4 space-y-1">
                              {provider.tokenData.scopes.map((scope) => (
                                <li key={scope}>{formatScope(scope)}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="chat-history" className="p-0">
          <Card className="shadow-none border-0">
            <CardHeader className="pb-3">
              <CardTitle>Chat History</CardTitle>
              <CardDescription>
                Access your saved conversations and continue where you left off.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingChats ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-24 w-full rounded-md" />
                  ))}
                </div>
              ) : chatError ? (
                <EmptyState
                  icon={<AlertCircle className="h-10 w-10 text-destructive" />}
                  title="Failed to load chats"
                  description={chatError}
                  action={
                    <Button onClick={fetchChatHistory} variant="default">
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Try Again
                    </Button>
                  }
                />
              ) : chatHistory.length === 0 ? (
                <EmptyState
                  icon={
                    <MessageSquare className="h-10 w-10 text-muted-foreground" />
                  }
                  title="No chat history"
                  description="Your chats will automatically be saved as you use the assistant."
                />
              ) : (
                <div className="space-y-4">
                  {chatHistory.map((chat) => (
                    <div
                      key={chat.id}
                      className="border rounded-lg hover:border-primary overflow-hidden transition-all cursor-pointer"
                      onClick={() => onLoadChat(chat.id)}
                    >
                      <div className="p-4">
                        <div className="flex justify-between items-start mb-1">
                          <div className="font-medium flex items-center">
                            {chat.title}
                            {chat.starred && (
                              <Star
                                className="h-4 w-4 ml-2 fill-yellow-400 text-yellow-400"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleStarChat(chat.id);
                                }}
                              />
                            )}
                          </div>
                          <div className="flex items-center space-x-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                shareChat(chat.id);
                              }}
                            >
                              <Share className="h-4 w-4 text-muted-foreground" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteChat(chat.id);
                              }}
                            >
                              <Trash className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {chat.preview}
                        </p>
                        <div className="text-xs text-muted-foreground mt-2">
                          {chat.date}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Application Preferences</CardTitle>
              <CardDescription>
                Customize your Sales Assistant experience
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Dark Mode</h3>
                  <p className="text-sm text-muted-foreground">
                    Toggle between light and dark theme
                  </p>
                </div>
                <Switch
                  checked={theme === "dark"}
                  onCheckedChange={(checked) =>
                    setTheme(checked ? "dark" : "light")
                  }
                  disabled={!mounted}
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <h3 className="font-medium">Default Chat Model</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Select which AI model to use for new conversations
                </p>
                <Select value={selectedModel} onValueChange={handleModelChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a model" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(availableModels).map(([id, model]) => (
                      <SelectItem key={id} value={id}>
                        {model.name} {model.paid ? "(Premium)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Sidebar Default</h3>
                  <p className="text-sm text-muted-foreground">
                    Show quick actions sidebar by default
                  </p>
                </div>
                <Switch
                  checked={sidebarDefault}
                  onCheckedChange={handleSidebarDefaultChange}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Auto-Save Chats</h3>
                  <p className="text-sm text-muted-foreground">
                    Automatically save all chat conversations
                  </p>
                </div>
                <Switch
                  checked={autoSaveChats}
                  onCheckedChange={handleAutoSaveChange}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
