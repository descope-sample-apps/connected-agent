import { useState, useEffect } from "react";

// Define provider information
const providers = {
  "google-calendar": {
    id: "google-calendar",
    name: "Google Calendar",
    icon: "/logos/google-calendar.png",
    scopes: ["https://www.googleapis.com/auth/calendar"],
    keywords: ["calendar", "schedule", "meeting", "availability", "free time"],
  },
  "google-docs": {
    id: "google-docs",
    name: "Google Docs",
    icon: "/logos/google-docs.png",
    scopes: ["https://www.googleapis.com/auth/documents"],
    keywords: [
      "document",
      "google doc",
      "notes",
      "write up",
      "write down",
      "minutes",
    ],
  },
  "google-meet": {
    id: "google-meet",
    name: "Google Meet",
    icon: "/logos/google-meet-logo.svg",
    scopes: ["https://www.googleapis.com/auth/meetings.space.created"],
    keywords: [
      "google meet",
      "video",
      "call",
      "conference",
      "video call",
      "video meeting",
    ],
  },
  "custom-crm": {
    id: "custom-crm",
    name: "Outbound CRM",
    icon: "/logos/crm-logo.png",
    scopes: ["openid", "contacts:read", "deals:read"],
    keywords: [
      "outbound",
      "customer",
      "lead",
      "deal",
      "opportunity",
      "contact",
      "sales",
    ],
  },
  slack: {
    id: "slack",
    name: "Slack",
    icon: "/logos/slack-logo.svg",
    scopes: [
      "chat:write",
      "channels:read",
      "channels:write",
      "users:read.email",
      "search:read",
      "channels:history",
    ],
    keywords: [
      "slack",
      "channel",
      "message",
      "#general",
      "post",
      "chat",
      "team chat",
    ],
  },
};

type ProviderKey = keyof typeof providers;

interface UseConnectionNotificationProps {
  message: string;
  isLLMResponse?: boolean;
  onConnectionSucceeded?: () => void;
}

interface UseConnectionNotificationReturn {
  provider: (typeof providers)[ProviderKey] | null;
  isNeeded: boolean;
  hideNotification: () => void;
  checkConnections: () => Promise<Record<string, boolean>>;
}

export function useConnectionNotification({
  message,
  isLLMResponse = false,
  onConnectionSucceeded,
}: UseConnectionNotificationProps): UseConnectionNotificationReturn {
  const [provider, setProvider] = useState<
    (typeof providers)[ProviderKey] | null
  >(null);
  const [isNeeded, setIsNeeded] = useState(false);

  // Check the LLM response for connection needs
  useEffect(() => {
    if (!isLLMResponse || !message) return;

    const needsConnection = detectConnectionNeed(message);
    if (needsConnection && needsConnection.provider) {
      setProvider(providers[needsConnection.provider]);
      setIsNeeded(true);
    }
  }, [message, isLLMResponse]);

  // Detect if the message indicates a need for a particular connection
  const detectConnectionNeed = (
    text: string
  ): { provider: ProviderKey } | null => {
    // If the message explicitly mentions needing connection
    if (
      text.toLowerCase().includes("need to connect") ||
      text.toLowerCase().includes("requires access") ||
      text.toLowerCase().includes("requires connection") ||
      text.toLowerCase().includes("not connected")
    ) {
      // Determine which provider is needed based on keywords
      for (const [key, providerInfo] of Object.entries(providers)) {
        if (
          providerInfo.keywords.some((keyword) =>
            text.toLowerCase().includes(keyword.toLowerCase())
          )
        ) {
          return { provider: key as ProviderKey };
        }
      }
    }

    return null;
  };

  // Function to check current connection status
  const checkConnections = async (): Promise<Record<string, boolean>> => {
    try {
      const response = await fetch("/api/oauth/connections");
      if (!response.ok) {
        throw new Error("Failed to check connections");
      }

      const data = await response.json();
      const connectionStatus: Record<string, boolean> = {};

      // Extract connection status for each provider
      Object.keys(providers).forEach((key) => {
        const providerData = data.connections[key];
        connectionStatus[key] = !!(providerData && providerData.connected);
      });

      return connectionStatus;
    } catch (error) {
      console.error("Error checking connections:", error);
      return Object.keys(providers).reduce((acc, key) => {
        acc[key] = false;
        return acc;
      }, {} as Record<string, boolean>);
    }
  };

  // Reset the notification state
  const hideNotification = () => {
    setIsNeeded(false);
    setProvider(null);
  };

  // Handle connection success
  const handleConnectionSuccess = () => {
    hideNotification();
    if (onConnectionSucceeded) {
      onConnectionSucceeded();
    }
  };

  return {
    provider,
    isNeeded,
    hideNotification,
    checkConnections,
  };
}
