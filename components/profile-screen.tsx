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
  ArrowUpDown,
  InfoIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  googleMeetId?: string;
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
  const [error, setError] = useState<string | null>(null);

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

      // Use a Map to ensure unique chat IDs
      const uniqueChats = new Map<string, ChatHistory>();

      // Transform and deduplicate the data
      data.chats.forEach((item: any) => {
        if (item.chat.id) {
          uniqueChats.set(item.chat.id, {
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
            starred: false,
            shared: false,
          });
        }
      });

      // Convert Map to array and sort by date
      const sortedChats = Array.from(uniqueChats.values()).sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateB.getTime() - dateA.getTime();
      });

      setChatHistory(sortedChats);
    } catch (error) {
      console.error("Error fetching chat history:", error);
      setChatError(
        error instanceof Error ? error.message : "Failed to load chat history"
      );
    } finally {
      setIsLoadingChats(false);
    }
  };

  // Add auto-refresh for chat history
  useEffect(() => {
    fetchChatHistory();
    const timer = setInterval(fetchChatHistory, 10000); // Refresh every 10 seconds
    return () => clearInterval(timer);
  }, []);

  // Fetch chat history on component mount
  useEffect(() => {
    fetchChatHistory();
  }, []);

  if (!user) return null;

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

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
          <h3 className="text-lg font-medium">Loading</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Please wait...
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

  const handleChatClick = (chatId: string) => {
    // Call the parent's onLoadChat first to update the state
    onLoadChat(chatId);

    // Update URL without reload
    if (typeof window !== "undefined") {
      const newUrl = new URL(window.location.href);
      newUrl.pathname = `/chat/${chatId}`;
      window.history.pushState({}, "", newUrl.toString());

      // Close the profile screen after navigation
      onBack();
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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="profile">Profile</TabsTrigger>
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
              <div className="mb-6">
                <Button
                  variant="outline"
                  className="w-full flex items-center justify-center gap-2"
                  onClick={() => (window.location.href = "/connections")}
                >
                  <ExternalLink className="h-4 w-4" />
                  Manage Connected Services
                </Button>
              </div>
              <UserProfile
                widgetId="user-profile-widget"
                theme={theme === "system" ? "light" : theme}
                onLogout={() => {
                  signOut();
                  window.location.href = "/login";
                }}
              />
            </CardContent>
          </Card>
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
                      onClick={() => handleChatClick(chat.id)}
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
