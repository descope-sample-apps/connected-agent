"use client";

import { Bot } from "lucide-react";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
}

export default function Logo({ size = "md", showText = true }: LogoProps) {
  const sizes = {
    sm: {
      container: "w-6 h-6",
      icon: "h-3 w-3",
      text: "text-sm ml-2",
    },
    md: {
      container: "w-10 h-10",
      icon: "h-5 w-5",
      text: "text-lg ml-2.5",
    },
    lg: {
      container: "w-16 h-16",
      icon: "h-8 w-8",
      text: "text-2xl ml-3",
    },
    xl: {
      container: "w-20 h-20",
      icon: "h-10 w-10",
      text: "text-3xl ml-3.5",
    },
  };

  return (
    <div className="flex items-center">
      <div
        className={`${sizes[size].container} rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md`}
      >
        <Bot className={`${sizes[size].icon} text-white`} />
      </div>
      {showText && (
        <h1
          className={`${sizes[size].text} font-bold bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent`}
        >
          ConnectedAgent
        </h1>
      )}
    </div>
  );
}
