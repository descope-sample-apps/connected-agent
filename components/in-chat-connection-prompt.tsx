"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, Calendar, Database, Lock, Zap } from "lucide-react";

interface InChatConnectionPromptProps {
  service: string;
  message: string;
  connectButtonText: string;
  connectButtonAction: string;
  alternativeMessage?: string;
}

export default function InChatConnectionPrompt({
  service,
  message,
  connectButtonText,
  connectButtonAction,
  alternativeMessage,
}: InChatConnectionPromptProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleConnect = async () => {
    setIsLoading(true);
    try {
      // Redirect to the connection endpoint
      window.location.href = connectButtonAction;
    } catch (error) {
      console.error("Connection error:", error);
      setIsLoading(false);
    }
  };

  const getIcon = () => {
    switch (service.toLowerCase()) {
      case "google calendar":
        return <Calendar className="h-7 w-7 text-blue-500" />;
      case "crm":
        return <Database className="h-7 w-7 text-emerald-500" />;
      default:
        return <ExternalLink className="h-7 w-7 text-primary" />;
    }
  };

  return (
    <Card className="border-primary/20 bg-white dark:bg-gray-900 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3 flex-1 mr-4">
          <div className="h-10 w-10 rounded-full bg-primary/10 dark:bg-primary/15 flex items-center justify-center">
            {getIcon()}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">
              {message || `Connect your ${service} to continue`}
            </p>
            {alternativeMessage && (
              <p className="mt-1 text-xs text-muted-foreground">
                {alternativeMessage}
              </p>
            )}
          </div>
        </div>
        <Button
          size="sm"
          onClick={handleConnect}
          disabled={isLoading}
          className="bg-primary hover:bg-primary/90 shadow-sm whitespace-nowrap"
        >
          {isLoading ? (
            <span className="flex items-center">
              <span className="mr-1.5 h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"></span>
              Connecting
            </span>
          ) : (
            <>
              Connect
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}
