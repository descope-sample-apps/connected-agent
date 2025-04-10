import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { nanoid } from "nanoid";
import ChatHeader from "@/app/components/ChatHeader";

async function getChatHistory() {
  try {
    // Determine the base URL
    const origin = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_BASE_URL
      ? process.env.NEXT_PUBLIC_BASE_URL
      : "http://localhost:3000";

    // Fetch the user's recent chats
    const response = await fetch(`${origin}/api/chats`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Failed to fetch chat history");
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching chat history:", error);
    return [];
  }
}

export default async function ChatHistoryPage() {
  const chatHistory = await getChatHistory();

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <ChatHeader title="Chat History" />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mb-6 flex justify-end">
          <Link
            href={`/chat/${nanoid()}`}
            className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg transition-all duration-200 hover:from-blue-600 hover:to-blue-700 hover:shadow-md shadow-sm font-medium text-sm"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                clipRule="evenodd"
              />
            </svg>
            New Chat
          </Link>
        </div>

        {chatHistory.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center max-w-lg mx-auto">
            <div className="w-16 h-16 bg-blue-100 rounded-full mx-auto flex items-center justify-center mb-4">
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
                  d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">
              No chat history found
            </h3>
            <p className="text-gray-500 mb-6">
              Start a new chat to begin your conversation with the AI assistant.
            </p>
            <Link
              href={`/chat/${nanoid()}`}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 font-medium text-sm"
            >
              Start New Chat
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 max-w-4xl mx-auto">
            {chatHistory.map((chat: any) => (
              <Link
                key={chat.id}
                href={`/chat/${chat.id}`}
                className="block bg-white p-5 rounded-xl border border-gray-100 hover:border-blue-100 hover:bg-blue-50 transition-all duration-200 shadow-sm hover:shadow-md group"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="font-medium text-gray-900 group-hover:text-blue-700 transition-colors duration-200">
                      {chat.title}
                    </h2>
                    <div className="flex items-center mt-2 text-sm text-gray-500">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 mr-1 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      {new Date(chat.createdAt).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                  <div className="text-gray-400 group-hover:text-blue-500 group-hover:translate-x-1 transition-all duration-200">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
