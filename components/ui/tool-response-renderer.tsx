"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ExternalLink,
  Calendar,
  Video,
  FileText,
  AlertCircle,
  ChevronDown,
  Wrench,
} from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface ToolResponseRendererProps {
  toolInvocation: any;
  onReconnectComplete?: () => void;
}

export function ToolResponseRenderer({
  toolInvocation,
  onReconnectComplete,
}: ToolResponseRendererProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate loading state for smoother transitions
    const timer = setTimeout(() => setIsLoading(false), 300);
    return () => clearTimeout(timer);
  }, []);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center space-x-2">
          <div className="h-2 w-2 rounded-full bg-zinc-400 animate-pulse" />
          <div className="h-2 w-2 rounded-full bg-zinc-400 animate-pulse delay-150" />
          <div className="h-2 w-2 rounded-full bg-zinc-400 animate-pulse delay-300" />
        </div>
      );
    }

    // Handle OAuth connection required responses
    if (
      toolInvocation.status === "error" &&
      toolInvocation.ui?.type === "connection_required"
    ) {
      return (
        <Card className="p-4 my-3 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/40">
                {toolInvocation.ui.service === "google-calendar" && (
                  <Calendar className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                )}
                {toolInvocation.ui.service === "zoom" && (
                  <Video className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                )}
                {toolInvocation.ui.service === "google-docs" && (
                  <FileText className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                )}
                {!toolInvocation.ui.service && (
                  <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                )}
              </div>
              <h3 className="font-medium text-amber-800 dark:text-amber-300">
                {toolInvocation.ui.service === "google-calendar" &&
                  "Google Calendar"}
                {toolInvocation.ui.service === "zoom" && "Zoom"}
                {toolInvocation.ui.service === "google-docs" && "Google Docs"}
                {!toolInvocation.ui.service && "Connection Required"}
              </h3>
            </div>
            <p className="text-amber-700 dark:text-amber-400">
              {toolInvocation.ui.message}
            </p>
            <Button
              variant="outline"
              className="bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/40 dark:hover:bg-amber-900/60 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300"
              onClick={() => {
                // Handle connection action
                if (toolInvocation.ui.connectButton?.action) {
                  // Construct the base connection URL
                  let connectUrl =
                    toolInvocation.ui.connectButton.action.replace(
                      "connection://",
                      "/api/oauth/connect/"
                    );
                  // Append scopes if they exist in the UI object
                  if (
                    toolInvocation.ui.requiredScopes &&
                    Array.isArray(toolInvocation.ui.requiredScopes) &&
                    toolInvocation.ui.requiredScopes.length > 0
                  ) {
                    const scopeString =
                      toolInvocation.ui.requiredScopes.join(",");
                    // Ensure we handle URL parameters correctly (add ? or &)
                    connectUrl += `${
                      connectUrl.includes("?") ? "&" : "?"
                    }scopes=${encodeURIComponent(scopeString)}`;
                  }

                  // Add the current chat ID to the URL as state to return to
                  const currentChatId = localStorage.getItem("currentChatId");
                  if (currentChatId) {
                    connectUrl += `${
                      connectUrl.includes("?") ? "&" : "?"
                    }chatId=${currentChatId}`;
                  }

                  // Store callback intention for when user returns from OAuth
                  if (onReconnectComplete) {
                    localStorage.setItem("pendingReconnectComplete", "true");
                  }

                  // Redirect the user to initiate the OAuth flow
                  window.location.href = connectUrl;
                }
              }}
            >
              {toolInvocation.ui.connectButton?.text || "Connect"}
            </Button>
          </div>
        </Card>
      );
    }

    // Handle successful calendar event creation
    if (
      toolInvocation.name === "createCalendarEvent" &&
      toolInvocation.status === "success"
    ) {
      return (
        <Card className="p-4 my-3 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/40">
                <Calendar className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="font-medium text-green-800 dark:text-green-300">
                Calendar Event Created
              </h3>
            </div>
            <div className="space-y-2">
              <p className="text-green-700 dark:text-green-400">
                {toolInvocation.result.title}
              </p>
              {toolInvocation.result.calendarEventLink && (
                <Button
                  variant="outline"
                  className="w-full bg-green-100 hover:bg-green-200 dark:bg-green-900/40 dark:hover:bg-green-900/60 border-green-300 dark:border-green-700 text-green-800 dark:text-green-300"
                  onClick={() =>
                    window.open(
                      toolInvocation.result.calendarEventLink,
                      "_blank"
                    )
                  }
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View in Calendar
                </Button>
              )}
            </div>
          </div>
        </Card>
      );
    }

    // Handle successful Zoom meeting creation
    if (
      toolInvocation.name === "createZoomMeeting" &&
      toolInvocation.status === "success"
    ) {
      return (
        <Card className="p-4 my-3 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/40">
                <Video className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="font-medium text-blue-800 dark:text-blue-300">
                Zoom Meeting Created
              </h3>
            </div>
            <div className="space-y-2">
              <p className="text-blue-700 dark:text-blue-400">
                {toolInvocation.result.topic}
              </p>
              {toolInvocation.result.join_url && (
                <Button
                  variant="outline"
                  className="w-full bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/40 dark:hover:bg-blue-900/60 border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-300"
                  onClick={() =>
                    window.open(toolInvocation.result.join_url, "_blank")
                  }
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Join Meeting
                </Button>
              )}
            </div>
          </div>
        </Card>
      );
    }

    // Handle successful document creation
    if (
      toolInvocation.name === "createDocument" &&
      toolInvocation.status === "success"
    ) {
      return (
        <Card className="p-4 my-3 bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900/40">
                <FileText className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="font-medium text-purple-800 dark:text-purple-300">
                Document Created
              </h3>
            </div>
            <div className="space-y-2">
              <p className="text-purple-700 dark:text-purple-400">
                {toolInvocation.result.title}
              </p>
              {toolInvocation.result.link && (
                <Button
                  variant="outline"
                  className="w-full bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/40 dark:hover:bg-purple-900/60 border-purple-300 dark:border-purple-700 text-purple-800 dark:text-purple-300"
                  onClick={() =>
                    window.open(toolInvocation.result.link, "_blank")
                  }
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Document
                </Button>
              )}
            </div>
          </div>
        </Card>
      );
    }

    // Handle successful calendar event listing
    if (
      toolInvocation.name === "listCalendarEvents" &&
      toolInvocation.status === "success"
    ) {
      return (
        <Card className="p-4 my-3 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/40">
                <Calendar className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="font-medium text-green-800 dark:text-green-300">
                Upcoming Calendar Events
              </h3>
            </div>
            <div className="space-y-2">
              {toolInvocation.result.events &&
              toolInvocation.result.events.length > 0 ? (
                <div className="space-y-2">
                  {toolInvocation.result.events.map(
                    (event: any, index: number) => (
                      <div
                        key={index}
                        className="p-2 bg-white dark:bg-zinc-800 rounded-md"
                      >
                        <p className="font-medium">{event.summary}</p>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                          {new Date(
                            event.start.dateTime || event.start.date
                          ).toLocaleString()}{" "}
                          -
                          {new Date(
                            event.end.dateTime || event.end.date
                          ).toLocaleString()}
                        </p>
                        {event.htmlLink && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-1 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/40 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300"
                            onClick={() =>
                              window.open(event.htmlLink, "_blank")
                            }
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            View
                          </Button>
                        )}
                      </div>
                    )
                  )}
                </div>
              ) : (
                <p className="text-green-700 dark:text-green-400">
                  No upcoming events found.
                </p>
              )}
            </div>
          </div>
        </Card>
      );
    }

    // Handle error responses
    if (toolInvocation.status === "error") {
      return (
        <Card className="p-4 my-3 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/40">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="font-medium text-red-800 dark:text-red-300">
                Error
              </h3>
            </div>
            <p className="text-red-700 dark:text-red-400">
              {toolInvocation.error ||
                "An error occurred while processing your request."}
            </p>
          </div>
        </Card>
      );
    }

    // Default rendering for other tool invocations
    return (
      <Card className="p-4 my-3 bg-zinc-50 dark:bg-zinc-900/20 border-zinc-200 dark:border-zinc-800">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-900/40">
              <Wrench className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
            </div>
            <h3 className="font-medium text-zinc-800 dark:text-zinc-300">
              Tool Response
            </h3>
          </div>
          <pre className="bg-white dark:bg-zinc-800 p-3 rounded-md overflow-auto text-sm">
            {JSON.stringify(toolInvocation, null, 2)}
          </pre>
        </div>
      </Card>
    );
  };

  return (
    <div
      className={cn(
        "rounded-lg border p-4 transition-all duration-300",
        isLoading ? "opacity-50" : "opacity-100",
        toolInvocation.type === "result" && toolInvocation.result?.ui
          ? "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700"
          : "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-800">
              <Wrench className="h-3 w-3 text-zinc-600 dark:text-zinc-400" />
            </div>
            <p className="text-sm font-medium">
              {toolInvocation.type === "result" && toolInvocation.result?.ui
                ? "Tool Response"
                : toolInvocation.type === "call"
                ? "Tool Call"
                : "Tool Result"}
            </p>
          </div>
          <div className="pl-8">{renderContent()}</div>
        </div>
        {toolInvocation.type === "result" && toolInvocation.result?.ui && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform duration-200",
                isExpanded ? "rotate-180" : ""
              )}
            />
          </Button>
        )}
      </div>
    </div>
  );
}
