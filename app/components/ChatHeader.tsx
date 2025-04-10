import React from "react";
import Link from "next/link";

interface ChatHeaderProps {
  title?: string;
  showBackButton?: boolean;
}

export default function ChatHeader({
  title = "AI Chatbot",
  showBackButton = false,
}: ChatHeaderProps) {
  return (
    <div className="bg-white border-b border-gray-100 p-4 md:p-6 flex items-center shadow-sm sticky top-0 z-10">
      <div className="flex items-center">
        {showBackButton && (
          <Link
            href="/chat"
            className="mr-4 text-gray-500 hover:text-gray-700 transition-colors duration-200 flex items-center"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                clipRule="evenodd"
              />
            </svg>
          </Link>
        )}
        <h1 className="text-xl font-semibold truncate bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          {title}
        </h1>
      </div>

      <div className="ml-auto flex items-center gap-4">
        <Link
          href="/chat"
          className="text-gray-700 hover:text-blue-600 transition-colors duration-200 text-sm font-medium px-3 py-1.5 rounded-md hover:bg-gray-50"
        >
          History
        </Link>
        <Link
          href="/"
          className="text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 transition-all duration-200 text-sm font-medium px-3 py-1.5 rounded-md shadow-sm hover:shadow"
        >
          New Chat
        </Link>
      </div>
    </div>
  );
}
