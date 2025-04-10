"use client";

import { useState } from "react";
import { SidebarHistory } from "@/components/sidebar-history";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import Logo from "@/components/logo";

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
          {!isCollapsed ? (
            <Logo size="sm" />
          ) : (
            <Logo size="sm" showText={false} />
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
