import React from "react";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import Chat from "@/components/chat";
import ChatHeader from "@/app/components/ChatHeader";
import { headers } from "next/headers";

// Define types based on schema
interface ChatType {
  id: string;
  userId: string;
  title: string;
  createdAt: Date;
  lastMessageAt: Date;
}

interface MessageType {
  id: string;
  createdAt: Date;
  chatId: string;
  role: string;
  parts: any;
  attachments: any;
  metadata: any;
}

async function getChatData(id: string) {
  // Determine the base URL
  const origin = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_BASE_URL
    ? process.env.NEXT_PUBLIC_BASE_URL
    : "http://localhost:3000";

  // Get the chat data without cookie header since it's server-to-server communication
  const res = await fetch(`${origin}/api/chats/${id}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    if (res.status === 404) {
      notFound();
    }
    throw new Error("Failed to fetch chat");
  }

  const chatData = (await res.json()) as ChatType;

  // Get the chat messages
  const res2 = await fetch(`${origin}/api/chats/${id}/messages`, {
    cache: "no-store",
  });

  if (!res2.ok) return null;
  const messagesData = await res2.json();

  return {
    chat: chatData,
    messages: messagesData.messages as MessageType[],
  };
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const data = await getChatData(params.id);

  return {
    title: data?.chat?.title || "Chat",
  };
}

export default async function ChatPage({ params }: { params: { id: string } }) {
  const data = await getChatData(params.id);
  if (!data) {
    notFound();
  }

  // Transform the messages for the Chat component
  const transformedMessages = data.messages.map((message) => {
    return {
      id: message.id,
      role: message.role as "user" | "assistant",
      content:
        typeof message.parts === "string"
          ? message.parts
          : Array.isArray(message.parts) && message.parts[0]?.text
          ? message.parts[0].text
          : JSON.stringify(message.parts),
    };
  });

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-white to-gray-50">
      <ChatHeader title={data.chat.title || "Chat"} showBackButton={true} />
      <div className="flex-1 overflow-hidden">
        <Chat id={params.id} initialMessages={transformedMessages} />
      </div>
    </div>
  );
}
