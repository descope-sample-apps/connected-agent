"use client";

import React, { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
  ui?: {
    type: string;
    service: string;
    message: string;
    connectButton: {
      text: string;
      action: string;
    };
  };
}

interface ChatProps {
  id?: string;
  initialMessages?: Message[];
  onNewChat?: () => void;
}

export default function Chat({
  id,
  initialMessages = [],
  onNewChat,
}: ChatProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleConnect = (action: string) => {
    if (action.startsWith("connection://")) {
      const service = action.replace("connection://", "");
      console.log(`Connecting to ${service}...`);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Connecting to ${service}...`,
        },
      ]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Save message to database if we have a chat ID
      if (id && messages.length === 0) {
        try {
          // Create a new chat with the first message
          await fetch("/api/chat/history", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id,
              title: input.trim().substring(0, 80), // Use first message as title
              message: userMessage,
            }),
          });
        } catch (error) {
          console.error("Error saving chat:", error);
        }
      } else if (id) {
        // Add message to existing chat
        try {
          await fetch(`/api/chat/messages?id=${id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: userMessage,
            }),
          });
        } catch (error) {
          console.error("Error saving message:", error);
        }
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          model: "gpt-4",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No reader available");
      }

      const decoder = new TextDecoder();
      let assistantMessage = "";
      let uiElement: Message["ui"] | undefined;

      try {
        // Initialize the assistant message in the state
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "", ui: undefined },
        ]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Decode the chunk and add it to the assistant message
          const chunk = decoder.decode(value);
          assistantMessage += chunk;

          // Check for UI elements in the content
          const uiMatch = assistantMessage.match(/<connection:(.*?)>/);
          if (uiMatch) {
            try {
              uiElement = JSON.parse(uiMatch[1]);
              // Remove the UI element from the message
              assistantMessage = assistantMessage.replace(
                /<connection:.*?>/,
                ""
              );
            } catch (e) {
              console.error("Error parsing UI element:", e);
            }
          }

          // Update the message in state
          setMessages((prev) => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage.role === "assistant") {
              lastMessage.content = assistantMessage;
              if (uiElement) {
                lastMessage.ui = uiElement;
              }
            }
            return newMessages;
          });
        }

        // Save the assistant message to the database if we have a chat ID
        if (id) {
          try {
            await fetch(`/api/chat/messages?id=${id}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                message: {
                  role: "assistant",
                  content: assistantMessage,
                  ui: uiElement,
                },
              }),
            });
          } catch (error) {
            console.error("Error saving assistant message:", error);
          }
        }
      } catch (error) {
        console.error("Error reading stream:", error);
        throw error;
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, there was an error processing your message.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 py-12">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-8 w-8 text-blue-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">
              Start a new conversation
            </h3>
            <p className="text-gray-500 max-w-md mb-6">
              Ask a question or type a message to begin chatting with the AI
              assistant.
            </p>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              } animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out`}
            >
              <div
                className={`max-w-[85%] md:max-w-[75%] rounded-2xl p-4 ${
                  message.role === "user"
                    ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md"
                    : "bg-white border border-gray-200 text-gray-800 shadow-sm"
                }`}
              >
                <div className="prose prose-sm">{message.content}</div>
                {message.ui && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-100 shadow-inner">
                    <p className="text-gray-700 mb-3 font-medium">
                      {message.ui.message}
                    </p>
                    <button
                      onClick={() =>
                        handleConnect(message.ui!.connectButton.action)
                      }
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 shadow-sm text-sm font-medium"
                    >
                      {message.ui.connectButton.text}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-4 md:p-6 border-t bg-white">
        <form onSubmit={handleSubmit} className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="w-full p-4 pr-16 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm bg-gray-50 placeholder-gray-400"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-colors duration-200 disabled:opacity-50 disabled:bg-gray-400"
          >
            {isLoading ? (
              <svg
                className="animate-spin h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
