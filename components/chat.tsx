"use client";

import { useState, useEffect } from "react";
import { getRecentToolActions, ToolActionResult } from "@/lib/oauth-utils";
import { ExternalLink } from "lucide-react";
import { useChat, Message as AIMessage } from "ai/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MeetingCard } from "@/components/meeting-card";

interface Message extends AIMessage {
  toolActions?: ToolActionResult[];
}

export default function Chat() {
  const { messages, input, handleInputChange, handleSubmit } = useChat();
  const [toolActions, setToolActions] = useState<ToolActionResult[]>([]);

  useEffect(() => {
    const fetchToolActions = async () => {
      try {
        const response = await fetch("/api/tools/actions");
        if (!response.ok) throw new Error("Failed to fetch tool actions");
        const data = await response.json();
        setToolActions(data.actions);
      } catch (error) {
        console.error("Error fetching tool actions:", error);
      }
    };

    fetchToolActions();
  }, []);

  const formatToolAction = (action: ToolActionResult) => {
    if (!action.success) {
      return `Failed to ${action.action.replace(/_/g, " ")}: ${
        action.details.error
      }`;
    }

    switch (action.action) {
      case "schedule_meeting":
        return `Meeting "${action.details.title}" scheduled${
          action.details.link ? ` ([View Meeting](${action.details.link}))` : ""
        }`;
      case "create_document":
        return `Document "${action.details.title}" created${
          action.details.link
            ? ` ([View Document](${action.details.link}))`
            : ""
        }`;
      case "create_event":
        return `Calendar event "${action.details.title}" created${
          action.details.link ? ` ([View Event](${action.details.link}))` : ""
        }`;
      default:
        return `Action "${action.action}" completed successfully`;
    }
  };

  const renderMessage = (message: Message) => {
    // Check if this is a meeting scheduled message
    if (message.role === "assistant" && message.content) {
      try {
        const content = JSON.parse(message.content);
        if (content.type === "meeting_scheduled") {
          return (
            <div key={message.id} className="flex justify-start">
              <MeetingCard
                message={content.ui.message}
                link={content.ui.link}
                details={content.ui.details}
              />
            </div>
          );
        }
      } catch (e) {
        // If parsing fails, it's a regular message
      }
    }

    // Regular message rendering
    return (
      <div
        key={message.id}
        className={`flex ${
          message.role === "assistant" ? "justify-start" : "justify-end"
        }`}
      >
        <div
          className={`rounded-lg px-4 py-2 max-w-[80%] ${
            message.role === "assistant"
              ? "bg-muted"
              : "bg-primary text-primary-foreground"
          }`}
        >
          {message.content}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => renderMessage(message as Message))}
        </div>
      </ScrollArea>
      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={handleInputChange}
            placeholder="Type your message..."
          />
          <Button type="submit">Send</Button>
        </div>
      </form>
    </div>
  );
}
