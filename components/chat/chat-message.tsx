import { cn } from "@/lib/utils";
import { Message } from "ai";
import { ToolResponseRenderer } from "@/components/ui/tool-response-renderer";

interface ExtendedMessage extends Message {
  tool_calls?: Array<{
    id: string;
    type: string;
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

interface ChatMessageProps {
  message: ExtendedMessage;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";
  const toolInvocation = message.tool_calls?.[0];

  return (
    <div
      className={cn(
        "flex w-full items-start gap-4 p-4",
        isUser ? "bg-zinc-50 dark:bg-zinc-900" : "bg-white dark:bg-zinc-950"
      )}
    >
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-md border shadow",
              isUser
                ? "bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700"
                : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700"
            )}
          >
            {isUser ? "U" : "A"}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">
              {isUser ? "You" : "Assistant"}
            </p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {message.content}
            </p>
          </div>
        </div>
        {toolInvocation && (
          <div className="mt-2">
            <ToolResponseRenderer toolInvocation={toolInvocation} />
          </div>
        )}
      </div>
    </div>
  );
}
