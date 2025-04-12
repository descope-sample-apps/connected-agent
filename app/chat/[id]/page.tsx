"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ChatPage({ params }: { params: { id: string } }) {
  const router = useRouter();

  // Use React.use() to properly unwrap params
  const unwrappedParams = React.use(params as any) as { id: string };
  const chatId = unwrappedParams.id;

  useEffect(() => {
    // Store the chat ID in localStorage
    if (typeof window !== "undefined") {
      // Store the chat ID
      localStorage.setItem("currentChatId", chatId);

      // Force a reload of the page to ensure the chat history is loaded
      window.location.href = "/";
    }
  }, [chatId]);

  // Show a loading state while redirecting
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
    </div>
  );
}
