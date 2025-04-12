"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";

interface ChatHistoryItem {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

interface SidebarHistoryProps {
  currentChatId: string;
  onChatSelect: (chatId: string) => void;
  onNewChat: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function SidebarHistory({
  currentChatId,
  onChatSelect,
  onNewChat,
  isCollapsed,
  onToggleCollapse,
}: SidebarHistoryProps) {
  const router = useRouter();
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch chat history
  useEffect(() => {
    const fetchChatHistory = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("/api/chats");
        if (!response.ok) {
          throw new Error("Failed to fetch chat history");
        }
        const data = await response.json();
        // Ensure unique chat IDs by using a Map
        const uniqueChats = new Map();
        (data.chats || []).forEach((chat: ChatHistoryItem) => {
          uniqueChats.set(chat.id, chat);
        });
        setChatHistory(Array.from(uniqueChats.values()));
      } catch (error) {
        console.error("Error fetching chat history:", error);
        toast({
          title: "Error",
          description: "Failed to load chat history",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchChatHistory();
  }, []);

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

  return (
    <div
      className={cn(
        "flex flex-col h-full transition-all duration-300",
        isCollapsed ? "w-12" : "w-64"
      )}
    >
      <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
        {!isCollapsed && (
          <h2 className="text-lg font-semibold bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
            Chat History
          </h2>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          className="ml-auto hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      <div className="p-2">
        {!isCollapsed && (
          <Button
            variant="outline"
            className="w-full mb-2 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-indigo-500"
            onClick={() => {
              onNewChat();
              // Update URL without reload
              if (typeof window !== "undefined") {
                const newUrl = new URL(window.location.href);
                newUrl.pathname = "/";
                window.history.pushState({}, "", newUrl.toString());
              }
            }}
          >
            New Chat
          </Button>
        )}
      </div>

      <Separator className="bg-gray-100 dark:bg-gray-800" />

      <ScrollArea className="flex-1 p-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-sm text-muted-foreground">Loading chats...</p>
          </div>
        ) : chatHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center p-4">
            <MessageSquare className="h-8 w-8 text-indigo-400 dark:text-indigo-500 mb-2" />
            <p className="text-sm text-muted-foreground">No chat history yet</p>
            {!isCollapsed && (
              <Button
                variant="link"
                className="mt-2 text-indigo-500 hover:text-indigo-600"
                onClick={() => {
                  onNewChat();
                  // Update URL without reload
                  if (typeof window !== "undefined") {
                    const newUrl = new URL(window.location.href);
                    newUrl.pathname = "/";
                    window.history.pushState({}, "", newUrl.toString());
                  }
                }}
              >
                Start a new chat
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            {chatHistory.map((chat, index) => (
              <div
                key={`${chat.id}-${index}`}
                className={cn(
                  "flex items-center justify-between p-2 rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 group transition-colors",
                  chat.id === currentChatId
                    ? "bg-gray-100 dark:bg-gray-800 border-l-2 border-indigo-500"
                    : ""
                )}
                onClick={() => handleChatClick(chat.id)}
              >
                {isCollapsed ? (
                  <MessageSquare
                    className={cn(
                      "h-4 w-4",
                      chat.id === currentChatId ? "text-indigo-500" : ""
                    )}
                  />
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          "text-sm font-medium truncate",
                          chat.id === currentChatId ? "text-indigo-500" : ""
                        )}
                      >
                        {chat.title || "Untitled Chat"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {(() => {
                          try {
                            return chat.updatedAt
                              ? formatDistanceToNow(new Date(chat.updatedAt), {
                                  addSuffix: true,
                                })
                              : "Recently";
                          } catch (error) {
                            console.error("Error formatting date:", error);
                            return "Recently";
                          }
                        })()}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-700"
                      onClick={(e) => handleDeleteChat(chat.id, e)}
                    >
                      <Trash2 className="h-3 w-3 text-gray-500 hover:text-red-500" />
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
