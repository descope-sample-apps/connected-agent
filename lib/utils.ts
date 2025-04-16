import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { UIMessage } from "ai";
import { v4 as uuidv4 } from "uuid";
import { messages } from "./db/schema";
import { Message } from "./db/queries";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Gets the most recent user message from an array of messages
 */
export function getMostRecentUserMessage(
  messages: UIMessage[]
): UIMessage | undefined {
  // Filter for user messages and get the last one
  return messages.filter((message) => message.role === "user").pop();
}

/**
 * Gets the trailing message ID for use in database operations
 */
export function getTrailingMessageId({
  messages,
}: {
  messages: UIMessage[];
}): string | undefined {
  return messages.length > 0 ? messages[messages.length - 1].id : undefined;
}

/**
 * Checks if a string is a valid email
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Determines if a query is CRM-related
 */
export function isCrmRelatedQuery(message: string): boolean {
  const crmKeywords = [
    "crm",
    "customer",
    "deal",
    "deals",
    "sales",
    "lead",
    "contact",
    "account",
    "company",
    "pipeline",
    "prospect",
    "opportunity",
    "Inc",
    "LLC",
    "Corp",
    "Corporation",
    "Ltd",
    "client",
  ];
  return crmKeywords.some((keyword) =>
    message.toLowerCase().includes(keyword.toLowerCase())
  );
}

/**
 * Extracts a potential company name from a query
 * @param message The user's query
 * @returns The extracted company name or null
 */
export function extractCompanyName(message: string): string | null {
  // Common patterns for company name mentions
  const patterns = [
    // "deals with <Company>"
    /(?:deals|transactions|opportunities)(?:\s+with|\s+for|\s+from|\s+at)\s+([A-Z][A-Za-z0-9\s]*(?:Inc|LLC|Corp|Corporation|Ltd)?)/i,
    // "deals for <Company>"
    /(?:deals|transactions|opportunities)(?:\s+at|\s+for|\s+from|\s+with)\s+([A-Z][A-Za-z0-9\s]*(?:Inc|LLC|Corp|Corporation|Ltd)?)/i,
    // "<Company> deals"
    /([A-Z][A-Za-z0-9\s]*(?:Inc|LLC|Corp|Corporation|Ltd)?)(?:\s+deals|\s+transactions|\s+opportunities)/i,
    // "information about <Company>"
    /information\s+(?:about|for|on)\s+([A-Z][A-Za-z0-9\s]*(?:Inc|LLC|Corp|Corporation|Ltd)?)/i,
    // Generic "<Company> Inc|LLC|Corp"
    /([A-Z][A-Za-z0-9\s]*(?:Inc|LLC|Corp|Corporation|Ltd))/,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return null;
}

/**
 * Determines if a query is calendar-related
 */
export function isCalendarRelatedQuery(message: string): boolean {
  const calendarKeywords = [
    "calendar",
    "schedule",
    "meeting",
    "appointment",
    "availability",
    "free time",
    "book",
    "set up",
    "discussion",
    "visit",
    "talk",
    "call",
    "sync",
    "review",
    "demo",
    "conference",
    "session",
    "catchup",
    "1:1",
    "one-on-one",
    "next week",
    "tomorrow",
    "this week",
    "for friday",
    "on monday",
    "plan a",
  ];
  return calendarKeywords.some((keyword) =>
    message.toLowerCase().includes(keyword.toLowerCase())
  );
}

/**
 * Fetches a resource with automatic retries on failure
 */
export async function fetchWithRetry<T>(
  url: string,
  options: RequestInit = {},
  retries = 3,
  backoff = 300
): Promise<T> {
  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      const error = new Error(`HTTP error! Status: ${response.status}`);
      (error as any).status = response.status;
      throw error;
    }

    return await response.json();
  } catch (error) {
    if (retries <= 1) throw error;

    await new Promise((resolve) => setTimeout(resolve, backoff));
    return fetchWithRetry(url, options, retries - 1, backoff * 2);
  }
}

/**
 * Converts database messages to UI messages
 */
export function convertToUIMessages(messages: Message[]): UIMessage[] {
  return messages.map((message) => ({
    id: message.id,
    parts: message.parts as UIMessage["parts"],
    role: message.role as UIMessage["role"],
    // Note: content will soon be deprecated in @ai-sdk/react
    content: "",
    createdAt: message.createdAt,
    experimental_attachments: (message.attachments as any[]) ?? [],
  }));
}
