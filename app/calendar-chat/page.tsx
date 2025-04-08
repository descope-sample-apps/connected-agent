"use client";

import { useState } from "react";
import { useChat } from "@ai-sdk/react";

// Card component for displaying calendar events
const CalendarEventCard = ({ event }: { event: any }) => {
  // Format the date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  };

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-4 mb-3">
      <h3 className="font-bold text-lg text-blue-600 dark:text-blue-400">
        {event.title}
      </h3>
      {event.start && (
        <div className="text-sm mb-1">
          <span className="font-medium">Start:</span> {formatDate(event.start)}
        </div>
      )}
      {event.end && (
        <div className="text-sm mb-2">
          <span className="font-medium">End:</span> {formatDate(event.end)}
        </div>
      )}
      {event.location && (
        <div className="text-sm mb-2">
          <span className="font-medium">Location:</span> {event.location}
        </div>
      )}
      {event.description && (
        <div className="text-sm mb-2">
          <span className="font-medium">Description:</span> {event.description}
        </div>
      )}
      {event.attendees && event.attendees.length > 0 && (
        <div className="text-sm mb-2">
          <span className="font-medium">Attendees:</span>{" "}
          {event.attendees.join(", ")}
        </div>
      )}
      {event.link && (
        <div className="mt-2">
          <a
            href={event.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-700 text-sm underline"
          >
            View in Calendar
          </a>
        </div>
      )}
    </div>
  );
};

// Calendar events list component
const CalendarEventsList = ({ events }: { events: any[] }) => {
  if (!events || events.length === 0) {
    return <div className="text-gray-500">No events found</div>;
  }

  return (
    <div className="my-4">
      <h2 className="text-xl font-semibold mb-3">Calendar Events</h2>
      <div>
        {events.map((event) => (
          <CalendarEventCard key={event.id} event={event} />
        ))}
      </div>
    </div>
  );
};

// Tool invocation renderer
const ToolInvocationRenderer = ({
  toolInvocation,
}: {
  toolInvocation: any;
}) => {
  // Handle calendar events specifically
  if (
    toolInvocation.name === "listCalendarEvents" &&
    toolInvocation.status === "success" &&
    Array.isArray(toolInvocation.result)
  ) {
    return <CalendarEventsList events={toolInvocation.result} />;
  }

  if (
    toolInvocation.name === "createCalendarEvent" &&
    toolInvocation.status === "success"
  ) {
    return (
      <div className="bg-green-100 dark:bg-green-900 p-4 rounded-lg my-3">
        <h3 className="font-bold text-green-700 dark:text-green-300">
          Calendar Event Created
        </h3>
        <p className="mt-2">
          {toolInvocation.result.title}
          {toolInvocation.result.link && (
            <a
              href={toolInvocation.result.link}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 text-blue-500 hover:text-blue-700 underline"
            >
              View in Calendar
            </a>
          )}
        </p>
      </div>
    );
  }

  // Default rendering for other tool invocations
  return (
    <pre className="bg-zinc-100 dark:bg-zinc-800 p-4 rounded-lg overflow-auto text-sm my-3">
      {JSON.stringify(toolInvocation, null, 2)}
    </pre>
  );
};

export default function CalendarChat() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } =
    useChat({
      api: "/api/chat2",
    });

  return (
    <div className="flex flex-col w-full max-w-3xl py-8 mx-auto stretch">
      <h1 className="text-2xl font-bold mb-6">Calendar Assistant</h1>

      <div className="flex-1 overflow-auto mb-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`p-4 rounded-lg ${
              message.role === "user"
                ? "bg-blue-100 dark:bg-blue-900 ml-auto"
                : "bg-gray-100 dark:bg-zinc-800 mr-auto"
            } max-w-[80%]`}
          >
            <div className="font-semibold mb-1">
              {message.role === "user" ? "You" : "Assistant"}
            </div>

            <div>
              {message.parts.map((part, i) => {
                switch (part.type) {
                  case "text":
                    return (
                      <div
                        key={`${message.id}-${i}`}
                        className="whitespace-pre-wrap"
                      >
                        {part.text}
                      </div>
                    );
                  case "tool-invocation":
                    return (
                      <ToolInvocationRenderer
                        key={`${message.id}-${i}`}
                        toolInvocation={part.toolInvocation}
                      />
                    );
                  default:
                    return null;
                }
              })}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="text-gray-500">Assistant is thinking...</div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="relative">
        <input
          className="w-full p-3 border border-zinc-300 dark:border-zinc-700 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-zinc-800 dark:text-white"
          value={input}
          placeholder="Ask about your calendar..."
          onChange={handleInputChange}
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 bg-blue-500 text-white px-3 py-1 rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Send
        </button>
      </form>
    </div>
  );
}
