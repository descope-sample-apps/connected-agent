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
import { Video, Calendar, X, Check } from "lucide-react";

interface InChatPromptProps {
  type: "zoom-meeting" | "calendar-event" | "authentication" | "confirmation";
  title: string;
  description: string;
  details?: Record<string, string>;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function InChatPrompt({
  type,
  title,
  description,
  details,
  onConfirm,
  onCancel,
}: InChatPromptProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      await onConfirm();
    } finally {
      setIsLoading(false);
    }
  };

  const getIcon = () => {
    switch (type) {
      case "zoom-meeting":
        return <Video className="h-6 w-6 text-primary" />;
      case "calendar-event":
        return <Calendar className="h-6 w-6 text-primary" />;
      case "authentication":
        return <Calendar className="h-6 w-6 text-primary" />;
      case "confirmation":
        return <Check className="h-6 w-6 text-primary" />;
      default:
        return <Calendar className="h-6 w-6 text-primary" />;
    }
  };

  return (
    <Card className="border-primary/20 bg-primary/5 dark:bg-primary/10">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            {getIcon()}
          </div>
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pb-2">
        <p className="text-sm text-muted-foreground">{description}</p>
        {details && (
          <div className="mt-3 space-y-1 text-sm">
            {Object.entries(details).map(([key, value]) => (
              <div key={key} className="flex justify-between">
                <span className="font-medium">{key}:</span>
                <span>{value}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-end gap-2 pt-0">
        <Button
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={isLoading}
        >
          <X className="mr-1 h-4 w-4" />
          No, thanks
        </Button>
        <Button size="sm" onClick={handleConfirm} disabled={isLoading}>
          {isLoading ? (
            <span className="flex items-center">
              <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></span>
              Processing...
            </span>
          ) : (
            <>
              <Check className="mr-1 h-4 w-4" />
              Yes, proceed
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
