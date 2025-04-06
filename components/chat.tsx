"use client";

import { useState, useEffect } from "react";
import { ExternalLink } from "lucide-react";
import { useChat, Message as AIMessage } from "ai/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MeetingCard } from "@/components/meeting-card";
import InChatConnectionPrompt from "@/components/in-chat-connection-prompt";
import { Calendar, Database } from "lucide-react";

// Define tool action result types
interface ToolActionResult {
  success: boolean;
  action: string;
  provider?: string;
  details: any;
  timestamp: string;
}

interface Message extends AIMessage {
  toolActions?: ToolActionResult[];
  actionCard?: {
    type: string;
    data: any;
  };
}

export default function Chat() {
  const { messages, input, handleInputChange, handleSubmit } = useChat();
  // Messages that have action cards to display
  const [messagesWithActions, setMessagesWithActions] = useState<string[]>([]);

  // Formats tool action results (for display purposes)
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

  // Process message content to look for action triggers
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === 'assistant' && lastMessage.content) {
      const content = lastMessage.content.toLowerCase();
      // Check for connection requirements in the text using multiple patterns
      if (
        // Look for common connection phrases
        ((content.includes("connect") && 
          (content.includes("calendar") || content.includes("crm") || content.includes("service"))) ||
         // Look for markdown link patterns related to connections
         (content.includes("connect") && content.includes("](connection:")) ||
         // Look for phrases about needing access
         (content.includes("need") && 
          (content.includes("access") || content.includes("connect")))) && 
        !messagesWithActions.includes(lastMessage.id)
      ) {
        console.log("Detected connection requirement in message:", lastMessage.id);
        setMessagesWithActions(prev => [...prev, lastMessage.id]);
      }
    }
  }, [messages]);

  // Render a standard message bubble
  const renderMessage = (message: Message) => {
    // Convert markdown links to regular text for display
    const processContent = (content: string) => {
      // Replace markdown links with just the link text 
      // E.g., [Connect Calendar](connection://calendar) -> Connect Calendar
      return content.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
    };
    
    return (
      <div
        className={`flex ${message.role === "assistant" ? "justify-start" : "justify-end"} mb-4`}
      >
        <div
          className={`rounded-lg px-4 py-2 max-w-[80%] ${
            message.role === "assistant"
              ? "bg-muted"
              : "bg-primary text-primary-foreground"
          }`}
        >
          {processContent(message.content)}
        </div>
      </div>
    );
  };

  // Render action card after a message if needed
  const renderActionCard = (messageId: string) => {
    // Find the message by ID
    const messageItem = messages.find((m) => m.id === messageId) as Message;
    if (!messageItem) return null;
    
    // Extract info from markdown links if present
    const extractConnectionInfo = (content: string) => {
      // Check for markdown links with connection:// urls
      const linkMatch = content.match(/\[([^\]]+)\]\(connection:\/\/([^)]+)\)/);
      if (linkMatch) {
        const [_, buttonText, serviceId] = linkMatch;
        return {
          buttonText, 
          serviceId,
          // Convert service-name to Service Name
          service: serviceId.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
        };
      }
      return null;
    };
    
    // Detect which service needs connection
    let service = "Service";
    let connectUrl = "/api/auth/service";
    let buttonText = "Connect Service";
    let alternativeMsg;
    
    // First try to extract from markdown link
    const connectionInfo = extractConnectionInfo(messageItem.content);
    if (connectionInfo) {
      service = connectionInfo.service;
      connectUrl = `/api/auth/${connectionInfo.serviceId}`;
      buttonText = connectionInfo.buttonText;
    } else {
      // Fallback to text pattern matching
      const content = messageItem.content.toLowerCase();
      if (content.includes("google calendar")) {
        service = "Google Calendar";
        connectUrl = "/api/auth/google-calendar";
        buttonText = "Connect Google Calendar";
      } else if (content.includes("calendar")) {
        service = "Calendar";
        connectUrl = "/api/auth/calendar"; 
        buttonText = "Connect Calendar";
      } else if (content.includes("crm")) {
        service = "CRM";
        connectUrl = "/api/auth/crm";
        buttonText = "Connect CRM";
        alternativeMsg = "Alternatively, you can provide email addresses directly.";
      }
    }
    
    return (
      <div className="mx-auto mb-8 max-w-2xl border-t border-primary/10 pt-4 mt-3">
        <p className="text-xs text-muted-foreground text-center mb-2">Connect to continue</p>
        <div className="border border-primary/20 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow bg-white dark:bg-gray-900">
          <InChatConnectionPrompt 
            service={service}
            message={`Connect your ${service} to access this functionality`}
            connectButtonText="Connect"
            connectButtonAction={connectUrl}
            alternativeMessage={alternativeMsg}
          />
        </div>
      </div>
    );
  };
  
  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-2">
          {messages.map((message, index) => {
            const isActionMessage = messagesWithActions.includes(message.id);
            return (
              <div key={message.id}>
                {renderMessage(message as Message)}
                {isActionMessage && renderActionCard(message.id)}
              </div>
            );
          })}
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
