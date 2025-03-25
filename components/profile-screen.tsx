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

interface OAuthProvider {
  id: string;
  name: string;
  icon: string;
  connected: boolean;
  tokenData?: {
    scopes: string[];
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

  // Mock data for OAuth providers - in a real app, this would come from Descope
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

  // Mock data for chat history
  const [chatHistory, setChatHistory] = useState<ChatHistory[]>([
    {
      id: "chat-1",
      title: "Acme Corp Deal Summary",
      preview:
        "Generated summary of the Acme Corp deal status and next steps...",
      date: "Today, 2:30 PM",
      starred: true,
      shared: false,
    },
    {
      id: "chat-2",
      title: "Meeting with TechStart Team",
      preview:
        "Scheduled a meeting with the TechStart team for next Tuesday...",
      date: "Yesterday, 11:15 AM",
      starred: false,
      shared: true,
    },
    {
      id: "chat-3",
      title: "Quarterly Sales Analysis",
      preview: "Analyzed Q1 sales performance across all regions...",
      date: "Mar 15, 2025",
      starred: true,
      shared: true,
    },
    {
      id: "chat-4",
      title: "New Lead Research",
      preview: "Researched potential leads in the healthcare sector...",
      date: "Mar 10, 2025",
      starred: false,
      shared: false,
    },
    {
      id: "chat-5",
      title: "Product Demo Preparation",
      preview: "Prepared talking points for the upcoming product demo...",
      date: "Mar 5, 2025",
      starred: false,
      shared: false,
    },
  ]);

  // Update the useEffect hook to fetch connection status
  useEffect(() => {
    const fetchConnectionStatus = async () => {
      if (!user) return;

      setIsLoading(true);
      try {
        const response = await fetch("/api/oauth/connections");
        if (!response.ok) throw new Error("Failed to fetch connections");

        const data = await response.json();
        console.log("Fetched connection data:", data);

        // Update the providers list with connection status and token data
        setOauthProviders((prevProviders) =>
          prevProviders.map((provider) => {
            const connectionData = data.connections[provider.id];
            const hasValidToken =
              connectionData?.token?.accessToken &&
              connectionData?.token?.scopes?.length > 0;

            return {
              ...provider,
              connected: hasValidToken,
              tokenData: hasValidToken
                ? {
                    scopes: connectionData.token.scopes,
                  }
                : undefined,
            };
          })
        );
      } catch (error) {
        console.error("Error fetching connection status:", error);
      } finally {
        setIsLoading(false);
      }
    };

    // Fetch connections when the connections tab is active
    if (activeTab === "connections") {
      fetchConnectionStatus();
    }
  }, [user, activeTab]);

  if (!user) return null;

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  const toggleConnection = async (providerId: string) => {
    setIsLoading(true);
    console.log("Starting OAuth connection for provider:", providerId);

    // If already connected, handle disconnection
    if (oauthProviders.find((p) => p.id === providerId)?.connected) {
      console.log("Provider already connected, handling disconnection");
      // Disconnect flow
      setTimeout(() => {
        setOauthProviders((providers) =>
          providers.map((provider) =>
            provider.id === providerId
              ? {
                  ...provider,
                  connected: false,
                  email: undefined,
                  lastSync: undefined,
                  scopes: undefined,
                }
              : provider
          )
        );
        setIsLoading(false);
      }, 1000);
    } else {
      try {
        // Get the current URL and preserve any existing query parameters
        const currentUrl = new URL(window.location.href);
        const searchParams = new URLSearchParams(currentUrl.search);

        // Add OAuth success flag and redirectTo parameter
        searchParams.set("oauth", "success");
        searchParams.set("redirectTo", "profile");

        // Construct the redirect URL with preserved context
        const redirectUrl = `${currentUrl.origin}${
          currentUrl.pathname
        }?${searchParams.toString()}`;

        console.log("Constructed redirect URL:", redirectUrl);
        console.log("Provider scopes:", getDefaultScopes(providerId));

        const url = await connectToOAuthProvider({
          appId: providerId,
          redirectUrl,
          scopes: getDefaultScopes(providerId),
        });

        console.log("Received authorization URL:", url);

        // Use the OAuth popup handler
        handleOAuthPopup(url, {
          onSuccess: () => {
            // Notify our backend about the new connection
            fetch("/api/oauth/store-connection", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                provider: providerId,
                scopes: getDefaultScopes(providerId),
                connectedAt: new Date().toISOString(),
              }),
            }).then(() => {
              console.log("Successfully stored connection in backend");
              // Update the UI to show connected state
              setOauthProviders((providers) =>
                providers.map((provider) =>
                  provider.id === providerId
                    ? {
                        ...provider,
                        connected: true,
                        email: user.email,
                        lastSync: "Just now",
                        scopes: getDefaultScopes(providerId),
                      }
                    : provider
                )
              );
              setIsLoading(false);
            });
          },
          onError: (error) => {
            console.error("Error connecting provider:", error);
            setIsLoading(false);
            if (error.message?.includes("Invalid attendee email")) {
              alert(
                "Some of the provided email addresses were rejected by Google Calendar. Please verify the email addresses and try again."
              );
            } else {
              alert(error.message || "Connection failed");
            }
          },
        });
      } catch (error) {
        console.error("Error connecting provider:", error);
        setIsLoading(false);
        alert(error instanceof Error ? error.message : "Connection failed");
      }
    }
  };

  // Helper function to get default scopes for different providers
  const getDefaultScopes = (providerId: string) => {
    const scopeMap: Record<string, string[]> = {
      "google-calendar": ["https://www.googleapis.com/auth/calendar"],
      "google-docs": ["https://www.googleapis.com/auth/documents"],
      zoom: ["meeting:write", "meeting:read"],
      salesforce: ["api", "refresh_token"],
      hubspot: ["crm.objects.contacts.read", "crm.objects.deals.read"],
      microsoft: ["Calendars.ReadWrite", "offline_access"],
    };

    return scopeMap[providerId] || ["basic"];
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
                onLogout={() => {
                  signOut();
                  window.location.href = "/login";
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="connections" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Connected Services</CardTitle>
              <CardDescription>
                Manage your connected OAuth providers and permissions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {oauthProviders.map((provider) => (
                <div
                  key={provider.id}
                  className="flex items-center justify-between py-4 border-b border-gray-100 dark:border-gray-800 last:border-0"
                >
                  <div className="flex items-center">
                    <div className="w-8 h-8 mr-3 flex-shrink-0">
                      <img
                        src={provider.icon}
                        alt={provider.name}
                        className="w-full h-full"
                      />
                    </div>
                    <div>
                      <h3 className="font-medium">{provider.name}</h3>
                      <div className="flex items-center mt-1">
                        {provider.connected ? (
                          <>
                            <Badge
                              variant="default"
                              className="mr-2 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                            >
                              Connected
                            </Badge>
                          </>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                          >
                            Not connected
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div>
                    {provider.connected ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleConnection(provider.id)}
                        className="mr-2"
                      >
                        Disconnect
                      </Button>
                    ) : (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => toggleConnection(provider.id)}
                      >
                        Connect
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="w-full">
            <CardHeader>
              <CardTitle>Data Access</CardTitle>
              <CardDescription>
                Review what the AI assistant can access through your connected
                services
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
                        variant={provider.connected ? "default" : "secondary"}
                      >
                        {provider.connected ? "Connected" : "Not Connected"}
                      </Badge>
                    </div>
                    {provider.connected && provider.tokenData && (
                      <div className="ml-8 text-sm text-muted-foreground">
                        <p className="mb-1">Granted Permissions:</p>
                        <ul className="list-disc pl-4 space-y-1">
                          {provider.tokenData.scopes.map((scope, index) => (
                            <li key={index}>
                              <code className="text-xs bg-muted px-1 py-0.5 rounded">
                                {scope}
                              </code>
                              <p className="mt-1">
                                {provider.id === "google-calendar" &&
                                  {
                                    "https://www.googleapis.com/auth/calendar":
                                      "Full access to manage your calendar, including reading, creating, and modifying events",
                                    "https://www.googleapis.com/auth/calendar.readonly":
                                      "Read-only access to view your calendar events",
                                    "https://www.googleapis.com/auth/calendar.events":
                                      "Access to manage calendar events only",
                                  }[scope]}
                                {provider.id === "google-docs" &&
                                  {
                                    "https://www.googleapis.com/auth/documents":
                                      "Full access to read and write Google Docs",
                                    "https://www.googleapis.com/auth/documents.readonly":
                                      "Read-only access to view Google Docs",
                                  }[scope]}
                                {provider.id === "zoom" &&
                                  {
                                    "meeting:write":
                                      "Permission to create and modify Zoom meetings",
                                    "meeting:read":
                                      "Permission to view Zoom meeting details",
                                  }[scope]}
                              </p>
                            </li>
                          ))}
                        </ul>
                        <p className="mt-3 mb-1">
                          Based on these permissions, the AI assistant can:
                        </p>
                        <ul className="list-disc pl-4 space-y-1">
                          {provider.id === "google-calendar" &&
                            provider.tokenData.scopes.includes(
                              "https://www.googleapis.com/auth/calendar"
                            ) && (
                              <>
                                <li>
                                  View, create, and edit all calendar events
                                </li>
                                <li>
                                  Check your availability and schedule meetings
                                </li>
                                <li>
                                  Send and respond to calendar invitations
                                </li>
                                <li>Create and manage multiple calendars</li>
                                <li>Set up recurring meetings and events</li>
                              </>
                            )}
                          {provider.id === "google-calendar" &&
                            provider.tokenData.scopes.includes(
                              "https://www.googleapis.com/auth/calendar.readonly"
                            ) && (
                              <>
                                <li>View your calendar events</li>
                                <li>Check your availability</li>
                                <li>View meeting details and participants</li>
                              </>
                            )}
                          {provider.id === "google-docs" &&
                            provider.tokenData.scopes.includes(
                              "https://www.googleapis.com/auth/documents"
                            ) && (
                              <>
                                <li>Create and edit documents</li>
                                <li>Read your existing documents</li>
                                <li>Generate and format content</li>
                                <li>Create document templates</li>
                              </>
                            )}
                          {provider.id === "zoom" &&
                            provider.tokenData.scopes.includes(
                              "meeting:write"
                            ) && (
                              <>
                                <li>Create and schedule new meetings</li>
                                <li>Generate and share meeting links</li>
                                <li>Configure meeting settings</li>
                              </>
                            )}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chat-history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Chat History</CardTitle>
              <CardDescription>
                View and manage your saved conversations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {chatHistory.length > 0 ? (
                  chatHistory.map((chat) => (
                    <div
                      key={chat.id}
                      className="flex items-start gap-4 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <MessageSquare className="h-5 w-5" />
                      </div>

                      <div
                        className="flex-1 min-w-0"
                        onClick={() => onLoadChat(chat.id)}
                        style={{ cursor: "pointer" }}
                      >
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium truncate">{chat.title}</h3>
                          {chat.starred && (
                            <Badge
                              variant="outline"
                              className="bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800"
                            >
                              <Star className="h-3 w-3" />
                            </Badge>
                          )}
                          {chat.shared && (
                            <Badge
                              variant="outline"
                              className="bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border-blue-200 dark:border-blue-800"
                            >
                              <Share2 className="h-3 w-3" />
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate mt-1">
                          {chat.preview}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {chat.date}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => toggleStarChat(chat.id)}
                        >
                          <Star
                            className={`h-4 w-4 ${
                              chat.starred
                                ? "fill-yellow-400 text-yellow-400"
                                : ""
                            }`}
                          />
                        </Button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => onLoadChat(chat.id)}
                            >
                              <MessageSquare className="mr-2 h-4 w-4" />
                              <span>Open Chat</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => shareChat(chat.id)}
                            >
                              <Share2 className="mr-2 h-4 w-4" />
                              <span>Share Chat</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => deleteChat(chat.id)}
                              className="text-red-600 focus:text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              <span>Delete Chat</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground opacity-50 mb-4" />
                    <h3 className="font-medium text-lg mb-2">
                      No saved chats yet
                    </h3>
                    <p className="text-muted-foreground">
                      Your chat history will appear here once you save
                      conversations
                    </p>
                  </div>
                )}
              </div>
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
                <Switch />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Notifications</h3>
                  <p className="text-sm text-muted-foreground">
                    Receive alerts for important updates
                  </p>
                </div>
                <Switch defaultChecked />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Sidebar Default</h3>
                  <p className="text-sm text-muted-foreground">
                    Show quick actions sidebar by default
                  </p>
                </div>
                <Switch defaultChecked />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Auto-Save Chats</h3>
                  <p className="text-sm text-muted-foreground">
                    Automatically save all chat conversations
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
