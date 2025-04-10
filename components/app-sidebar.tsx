"use client";

import { useState } from "react";
import { SidebarHistory } from "@/components/sidebar-history";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Menu, Bot } from "lucide-react";

interface AppSidebarProps {
  currentChatId: string;
  onChatSelect: (chatId: string) => void;
  onNewChat: () => void;
}

export function AppSidebar({
  currentChatId,
  onChatSelect,
  onNewChat,
}: AppSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  const toggleMobileOpen = () => {
    setIsMobileOpen(!isMobileOpen);
  };

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden fixed top-4 left-4 z-50 hover:bg-gray-100 dark:hover:bg-gray-800"
        onClick={toggleMobileOpen}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Sidebar */}
      <div
        className={cn(
          "fixed top-0 left-0 h-full bg-background border-r z-40 transition-all duration-300 shadow-sm border-gray-100 dark:border-gray-800",
          isCollapsed ? "w-12" : "w-64",
          isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div
          className={cn(
            "flex items-center h-14 px-4 border-b border-gray-100 dark:border-gray-800",
            isCollapsed ? "justify-center" : "justify-start"
          )}
        >
          {!isCollapsed && (
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <Bot className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="font-semibold text-base bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
                ConnectedAgent
              </span>
            </div>
          )}
          {isCollapsed && (
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Bot className="h-3.5 w-3.5 text-white" />
            </div>
          )}
        </div>
        <SidebarHistory
          currentChatId={currentChatId}
          onChatSelect={(chatId) => {
            onChatSelect(chatId);
            setIsMobileOpen(false);
          }}
          onNewChat={() => {
            onNewChat();
            setIsMobileOpen(false);
          }}
          isCollapsed={isCollapsed}
          onToggleCollapse={toggleCollapse}
        />
      </div>

      {/* Overlay for mobile */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}
    </>
  );
}
