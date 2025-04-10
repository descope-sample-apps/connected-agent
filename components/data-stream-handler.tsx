"use client";

import { useEffect } from "react";

interface DataStreamHandlerProps {
  id: string;
}

export function DataStreamHandler({ id }: DataStreamHandlerProps) {
  useEffect(() => {
    const eventSource = new EventSource(`/api/chat/stream?id=${id}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // Handle different types of stream data
        if (data.type === "toolActivity") {
          console.log("Tool activity:", data);
        } else if (data.type === "message") {
          console.log("Message:", data);
        }
      } catch (error) {
        console.error("Error parsing stream data:", error);
      }
    };

    eventSource.onerror = (error) => {
      console.error("Stream error:", error);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [id]);

  return null;
}
