"use client";

import React, { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "@/components/ui/use-toast";

export default function ChatPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Unwrap params with React.use() as suggested by the warning
  const unwrappedParams = React.use(params as any) as { id: string };
  const chatId = unwrappedParams.id;

  useEffect(() => {
    // Store the chat ID in localStorage
    if (typeof window !== "undefined") {
      // Check if chat ID is valid format to avoid issues
      if (chatId && chatId.length > 5) {
        console.log("Setting active chat ID:", chatId);
        localStorage.setItem("currentChatId", chatId);

        // Check if this is an OAuth return (has code or error parameter)
        const code = searchParams.get("code");
        const error = searchParams.get("error");

        if (code || error) {
          console.log("Detected OAuth return with", code ? "code" : "error");

          // Handle OAuth success or error
          if (code) {
            toast({
              title: "Connection Successful",
              description: "Your account has been connected successfully.",
            });
          } else if (error) {
            toast({
              title: "Connection Failed",
              description: `Failed to connect: ${error}`,
              variant: "destructive",
            });
          }

          // Clean up URL by removing OAuth parameters
          // This is important to avoid showing sensitive tokens in the URL
          const url = new URL(window.location.href);
          url.search = "";
          window.history.replaceState({}, "", url.toString());
        }

        // Instead of redirecting to root, just reload the page with query param to indicate
        // we should load messages for this chat ID
        router.push(`/?chatId=${chatId}`);
      } else {
        console.error("Invalid chat ID:", chatId);
        // Redirect to home page if chat ID is invalid
        router.push("/");
      }
    }
  }, [chatId, router, searchParams]);

  // Show a loading state while redirecting
  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
      <p className="text-gray-600 dark:text-gray-400 mb-2">
        Loading your conversation...
      </p>
      <p className="text-sm text-gray-500 dark:text-gray-500">
        Please wait while we retrieve your chat history
      </p>
    </div>
  );
}
