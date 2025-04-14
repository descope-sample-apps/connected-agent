"use client";

import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import {
  MessageSquare,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  Search,
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ChatHistoryItem {
  id: string;
  title: string;
  preview: string;
  date: string;
  updatedAt: string;
  createdAt: string;
}

interface SidebarHistoryProps {
  currentChatId: string;
  onChatSelect: (chatId: string) => void;
  onNewChat: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  isAuthenticated: boolean;
}

export const SidebarHistory = forwardRef<
  { fetchChatHistory: () => void },
  SidebarHistoryProps
>(
  (
    {
      currentChatId,
      onChatSelect,
      onNewChat,
      isCollapsed = false,
      onToggleCollapse,
      isAuthenticated,
    },
    ref
  ) => {
    const router = useRouter();
    const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [error, setError] = useState<string | null>(null);

    // Fetch chat history
    const fetchChatHistory = async (showLoading = true) => {
      if (!isAuthenticated) return;

      try {
        if (showLoading) {
          setIsLoading(true);
        }

        const response = await fetch("/api/chat/history", {
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("Failed to fetch chat history");
        }

        const data = await response.json();

        if (!data.chats || !Array.isArray(data.chats)) {
          throw new Error("Invalid chat data received");
        }

        // Use a Map to ensure unique chat IDs and maintain the most recent version of each chat
        const uniqueChats = new Map<string, ChatHistoryItem>();

        data.chats.forEach((chat: ChatHistoryItem) => {
          if (chat.id && chat.title) {
            // If we already have this chat, only update if the new version is more recent
            const existingChat = uniqueChats.get(chat.id);
            if (existingChat) {
              const existingDate = new Date(
                existingChat.updatedAt || existingChat.createdAt
              );
              const newDate = new Date(chat.updatedAt || chat.createdAt);
              if (newDate > existingDate) {
                uniqueChats.set(chat.id, chat);
              }
            } else {
              uniqueChats.set(chat.id, chat);
            }
          }
        });

        // Convert Map back to array and sort by most recent first
        const sortedChats = Array.from(uniqueChats.values()).sort((a, b) => {
          const dateA = new Date(a.updatedAt || a.createdAt);
          const dateB = new Date(b.updatedAt || b.createdAt);
          return dateB.getTime() - dateA.getTime();
        });

        setChatHistory(sortedChats);
      } catch (error) {
        console.error("Error fetching chat history:", error);
        toast({
          title: "Error",
          description: "Failed to load chat history",
          variant: "destructive",
        });
      } finally {
        if (showLoading) {
          setIsLoading(false);
        }
      }
    };

    // Expose fetchChatHistory through ref
    useImperativeHandle(ref, () => ({
      fetchChatHistory,
    }));

    // Fetch chat history on mount and when currentChatId changes
    useEffect(() => {
      fetchChatHistory();
    }, [currentChatId, isAuthenticated]); // Only fetch when chat ID or auth status changes

    // Filter chats based on search query
    const filteredChats = chatHistory.filter(
      (chat) =>
        chat.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        "Untitled Chat".toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Handle chat deletion
    const handleDeleteChat = async (chatId: string, e: React.MouseEvent) => {
      e.stopPropagation(); // Prevent chat selection when deleting

      if (!confirm("Are you sure you want to delete this chat?")) {
        return;
      }

      try {
        // Delete from the database
        const response = await fetch(`/api/chats/${chatId}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          throw new Error("Failed to delete chat");
        }

        // Remove the deleted chat from the list
        setChatHistory((prev) => prev.filter((chat) => chat.id !== chatId));

        // If the deleted chat was the current one, create a new chat and go to home
        if (chatId === currentChatId) {
          onNewChat();
          // Navigate to home page
          if (typeof window !== "undefined") {
            window.location.href = "/";
          }
        }

        toast({
          title: "Success",
          description: "Chat deleted successfully",
        });
      } catch (error) {
        console.error("Error deleting chat:", error);
        toast({
          title: "Error",
          description: "Failed to delete chat",
          variant: "destructive",
        });
      }
    };

    const handleChatClick = (chatId: string) => {
      if (!chatId) return;

      // Call the parent's onChatSelect first to update the state
      onChatSelect(chatId);

      // Update URL without reload
      if (typeof window !== "undefined") {
        const newUrl = new URL(window.location.href);
        newUrl.pathname = `/chat/${chatId}`;
        window.history.pushState({}, "", newUrl.toString());
      }
    };

    const handleNewChat = () => {
      onNewChat();
      // Update URL without reload
      if (typeof window !== "undefined") {
        const newUrl = new URL(window.location.href);
        newUrl.pathname = "/";
        window.history.pushState({}, "", newUrl.toString());
      }
    };

    return (
      <div
        className={cn(
          "flex flex-col h-full transition-all duration-300 ease-in-out border-r border-gray-100 dark:border-gray-800",
          isCollapsed ? "w-16" : "w-64"
        )}
      >
        <div className="flex items-center justify-between p-3 border-b border-gray-100 dark:border-gray-800">
          {!isCollapsed && (
            <h2 className="text-lg font-semibold bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
              Chat History
            </h2>
          )}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onToggleCollapse}
                  className={cn(
                    "ml-auto hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors",
                    isCollapsed ? "mx-auto" : ""
                  )}
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <ChevronLeft className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side={isCollapsed ? "right" : "bottom"}>
                {isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="p-2">
          {!isCollapsed ? (
            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full mb-2 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-indigo-500 transition-colors"
                onClick={handleNewChat}
              >
                <Plus className="h-4 w-4 mr-2" />
                New Chat
              </Button>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search chats..."
                  className="pl-8 h-9 text-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="w-full mb-2 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-indigo-500 transition-colors"
                    onClick={handleNewChat}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">New Chat</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        <Separator className="bg-gray-100 dark:bg-gray-800" />

        <ScrollArea className="flex-1 p-2">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-pulse flex space-x-2">
                <div className="h-2 w-2 bg-indigo-500 rounded-full"></div>
                <div className="h-2 w-2 bg-indigo-500 rounded-full"></div>
                <div className="h-2 w-2 bg-indigo-500 rounded-full"></div>
              </div>
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center p-4">
              {!isCollapsed ? (
                <>
                  <MessageSquare className="h-8 w-8 text-indigo-400 dark:text-indigo-500 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {searchQuery
                      ? "No matching chats found"
                      : "No chat history yet"}
                  </p>
                  <Button
                    variant="link"
                    className="mt-2 text-indigo-500 hover:text-indigo-600"
                    onClick={handleNewChat}
                  >
                    Start a new chat
                  </Button>
                </>
              ) : (
                <div className="flex flex-col items-center">
                  <MessageSquare className="h-6 w-6 text-indigo-400 dark:text-indigo-500 mb-1" />
                  <div className="h-1 w-1 rounded-full bg-indigo-500"></div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredChats.map((chat, index) => (
                <TooltipProvider key={`${chat.id}-${index}`}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className={cn(
                          "flex items-center justify-between p-2 rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 group transition-colors",
                          chat.id === currentChatId
                            ? "bg-gray-100 dark:bg-gray-800 border-l-2 border-indigo-500"
                            : ""
                        )}
                        onClick={() => handleChatClick(chat.id)}
                      >
                        {isCollapsed ? (
                          <div className="flex flex-col items-center mx-auto">
                            <MessageSquare
                              className={cn(
                                "h-4 w-4 mb-1",
                                chat.id === currentChatId
                                  ? "text-indigo-500"
                                  : "text-gray-500"
                              )}
                            />
                            <div className="h-1 w-1 rounded-full bg-indigo-500"></div>
                          </div>
                        ) : (
                          <>
                            <div className="flex-1 min-w-0">
                              <p
                                className={cn(
                                  "text-sm font-medium truncate",
                                  chat.id === currentChatId
                                    ? "text-indigo-500"
                                    : ""
                                )}
                              >
                                {chat.title || "Untitled Chat"}
                              </p>
                              <div className="flex items-center text-xs text-muted-foreground truncate">
                                <Clock className="h-3 w-3 mr-1 flex-shrink-0" />
                                <span className="truncate">
                                  {(() => {
                                    try {
                                      return chat.updatedAt
                                        ? formatDistanceToNow(
                                            new Date(chat.updatedAt),
                                            {
                                              addSuffix: true,
                                            }
                                          )
                                        : "Recently";
                                    } catch (error) {
                                      console.error(
                                        "Error formatting date:",
                                        error
                                      );
                                      return "Recently";
                                    }
                                  })()}
                                </span>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-red-500"
                              onClick={(e) => handleDeleteChat(chat.id, e)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TooltipTrigger>
                    {isCollapsed && (
                      <TooltipContent side="right" className="max-w-[200px]">
                        <div className="font-medium">
                          {chat.title || "Untitled Chat"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {(() => {
                            try {
                              return chat.updatedAt
                                ? formatDistanceToNow(
                                    new Date(chat.updatedAt),
                                    {
                                      addSuffix: true,
                                    }
                                  )
                                : "Recently";
                            } catch (error) {
                              return "Recently";
                            }
                          })()}
                        </div>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    );
  }
);
