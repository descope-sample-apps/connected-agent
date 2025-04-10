import React from "react";
import { notFound } from "next/navigation";
import Chat from "@/app/components/Chat";
import ChatHeader from "@/app/components/ChatHeader";
import { chats, messages } from "@/lib/db/schema";

// Define types based on schema
type ChatType = typeof chats.$inferSelect;
type MessageType = typeof messages.$inferSelect;

// Define the format expected by the Chat component
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

async function getChatById(id: string) {
  // Determine the base URL
  const origin = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_BASE_URL
    ? process.env.NEXT_PUBLIC_BASE_URL
    : "http://localhost:3000";

  const res = await fetch(`${origin}/api/chat/history?id=${id}`, {
    cache: "no-store",
  });

  if (!res.ok) return null;
  const data = await res.json();
  return data.chat as ChatType;
}

async function getMessagesForChat(id: string) {
  // Determine the base URL
  const origin = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_BASE_URL
    ? process.env.NEXT_PUBLIC_BASE_URL
    : "http://localhost:3000";

  const res = await fetch(`${origin}/api/chat/messages?id=${id}`, {
    cache: "no-store",
  });

  if (!res.ok) return [];
  const data = await res.json();
  return data.messages as MessageType[];
}

// Transform database messages to the format expected by the Chat component
function transformMessages(dbMessages: MessageType[]): ChatMessage[] {
  return dbMessages.map((msg) => {
    // Extract content from parts
    let content = "";
    if (Array.isArray(msg.parts)) {
      content = msg.parts
        .map((part: any) => {
          if (typeof part === "string") return part;
          if (part.text) return part.text;
          return JSON.stringify(part);
        })
        .join("");
    } else if (typeof msg.parts === "string") {
      content = msg.parts;
    } else if (msg.parts && typeof msg.parts === "object") {
      content = JSON.stringify(msg.parts);
    }

    return {
      id: msg.id,
      role: msg.role as "user" | "assistant",
      content,
    };
  });
}

export default async function ChatPage({ params }: { params: { id: string } }) {
  const chat = await getChatById(params.id);
  if (!chat) {
    notFound();
  }

  const messages = await getMessagesForChat(params.id);

  // Transform the messages for the Chat component
  const transformedMessages = transformMessages(messages);

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-white to-gray-50">
      <ChatHeader title={chat.title || "Chat"} showBackButton={true} />
      <div className="flex-1 overflow-hidden">
        <Chat id={params.id} initialMessages={transformedMessages} />
      </div>
    </div>
  );
}
