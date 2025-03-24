import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useOAuth } from "@/context/oauth-context";
import { validateAndRequestToken } from "@/lib/oauth-utils";

interface ChatMessageProps {
  message: {
    role: string;
    content: string;
    parts?: Array<{
      type: string;
      text: string;
    }>;
  };
  onReconnectComplete: () => void;
}

export default function ChatMessage({
  message,
  onReconnectComplete,
}: ChatMessageProps) {
  const [reconnectProvider, setReconnectProvider] = useState<string | null>(
    null
  );
  const [requiredScopes, setRequiredScopes] = useState<string[]>([]);
  const { setShowReconnectDialog, setReconnectInfo } = useOAuth();

  // Check if the message contains a scope-related error
  const checkForScopeError = async (content: string) => {
    try {
      // Look for error patterns in the message
      const scopeErrorMatch = content.match(
        /(?:insufficient_scopes|connection_required).*?provider: "([^"]+)".*?requiredScopes: \[(.*?)\]/m
      );

      if (scopeErrorMatch) {
        const [, provider, scopesStr] = scopeErrorMatch;
        const scopes = scopesStr
          .split(",")
          .map((s) => s.trim().replace(/"/g, ""))
          .filter(Boolean);

        setReconnectProvider(provider);
        setRequiredScopes(scopes);

        // Show the reconnection dialog
        setReconnectInfo({ appId: provider, scopes });
        setShowReconnectDialog(true);
      }
    } catch (error) {
      console.error("Error checking for scope error:", error);
    }
  };

  // Check message content when it changes
  useEffect(() => {
    if (message.role === "assistant") {
      checkForScopeError(message.content);
    }
  }, [message]);

  return (
    <div
      className={`flex ${
        message.role === "user" ? "justify-end" : "justify-start"
      } mb-4`}
    >
      <div
        className={`max-w-[80%] rounded-lg p-4 ${
          message.role === "user"
            ? "bg-primary text-primary-foreground"
            : "bg-muted"
        }`}
      >
        {message.parts ? (
          message.parts.map((part, index) => <div key={index}>{part.text}</div>)
        ) : (
          <div>{message.content}</div>
        )}
      </div>
    </div>
  );
}
