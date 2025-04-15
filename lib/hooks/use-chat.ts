import React, { useState, useCallback } from "react";
import { nanoid } from "nanoid";

export interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
}

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim() || isLoading) return;

      const userMessage: Message = {
        id: nanoid(),
        content: input,
        role: "user",
      };

      // Optimistically update UI
      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setIsLoading(true);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: [...messages, userMessage] }),
        });

        if (!response.ok) throw new Error("Failed to send message");

        const data = await response.json();

        // Batch state updates
        requestAnimationFrame(() => {
          setMessages((prev) => [...prev, data.message]);
          setIsLoading(false);
        });
      } catch (error) {
        console.error("Error sending message:", error);
        setIsLoading(false);
        // Optionally show error state to user
      }
    },
    [input, isLoading, messages]
  );

  return {
    messages,
    input,
    setInput,
    handleSubmit,
    isLoading,
  };
}
