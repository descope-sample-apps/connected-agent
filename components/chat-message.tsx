import type { Message } from "ai";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Bot, User } from "lucide-react";

interface ChatMessageProps {
  message: Message;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "flex gap-3 max-w-[80%]",
          isUser ? "flex-row-reverse" : "flex-row"
        )}
      >
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 select-none items-center justify-center rounded-full shadow-sm",
            isUser
              ? "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
              : "bg-gray-100 dark:bg-gray-800"
          )}
        >
          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </div>
        <Card
          className={cn(
            "shadow-sm",
            isUser
              ? "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700"
              : "bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700"
          )}
        >
          <CardContent
            className={cn(
              "p-4 text-sm leading-relaxed",
              isUser
                ? "text-gray-800 dark:text-gray-200"
                : "text-gray-700 dark:text-gray-300"
            )}
          >
            {message.content}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
