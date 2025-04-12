import React from "react";
import { useChat } from "@ai-sdk/react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import ChatMessage from "@/components/chat-message";
import { Loader2 } from "lucide-react";

interface ChatInterfaceProps {
  chatId: string;
  selectedModel?: string;
  initialMessages?: any[];
  onMessagesUpdate?: (messages: any[]) => void;
}

export default function ChatInterface({
  chatId,
  selectedModel,
  initialMessages = [],
  onMessagesUpdate,
}: ChatInterfaceProps) {
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    append,
  } = useChat({
    api: "/api/chat",
    body: {
      id: chatId,
      selectedChatModel: selectedModel,
    },
    credentials: "include",
    initialMessages,
  });

  // Update parent component when messages change
  React.useEffect(() => {
    if (onMessagesUpdate) {
      onMessagesUpdate(messages);
    }
  }, [messages, onMessagesUpdate]);

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 pb-20">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-4 text-center">
            <p className="text-gray-500 mb-4">No messages in this chat yet.</p>
            <p className="text-gray-400 text-sm">
              Start a conversation by typing below!
            </p>
          </div>
        ) : (
          <div className="space-y-6 p-4">
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={{
                  role: message.role,
                  content:
                    typeof message.content === "string" ? message.content : "",
                  parts: message.parts?.map((part) => ({
                    type: part.type,
                    text: "text" in part ? part.text || "" : "",
                  })),
                }}
                onReconnectComplete={() => {}}
              />
            ))}
          </div>
        )}
      </ScrollArea>
      <div className="border-t bg-white p-4">
        <form onSubmit={handleSubmit} className="flex space-x-2">
          <Input
            value={input}
            onChange={handleInputChange}
            placeholder="Type your message..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" disabled={isLoading || input.trim() === ""}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
          </Button>
        </form>
      </div>
    </div>
  );
}
