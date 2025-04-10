import { session } from "@descope/nextjs-sdk/server";
import {
  getGoogleCalendarToken,
  getGoogleDocsToken,
  getZoomToken,
  getCRMToken,
} from "@/lib/descope";
import { trackOAuthEvent, trackError } from "@/lib/analytics";
import { getChatById, getChatMessages } from "@/lib/db/queries";
import { nanoid } from "nanoid";
import { openai as openaiSDK } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { groq } from "@ai-sdk/groq";
import type { Provider } from "ai";
import { fetchWithRetry as fetchRetry } from "@/lib/utils";
import OpenAI from "openai";

export const runtime = "nodejs";

// In a real implementation, this would be stored in a database
const sharedChats: Record<
  string,
  { chatId: string; userId: string; expiresAt?: Date }
> = {};

// Main endpoint to get all OAuth connections for the user
export async function GET() {
  const userSession = await session();
  const userId = userSession?.token?.sub;

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("Fetching OAuth connections for user:", userId);
    trackOAuthEvent("connection_initiated", {
      userId,
      action: "check_all_connections",
    });

    // Get the status of all OAuth connections using default operations from lib/descope.ts
    console.log("Starting OAuth provider token fetch");
    const [googleCalendar, googleDocs, zoom, customCrm] = await Promise.all([
      getGoogleCalendarToken(userId).catch((e) => {
        console.error("Error fetching Google Calendar token:", e);
        console.error("Google Calendar error details:", {
          name: e.name,
          message: e.message,
          status: e.status,
          stack: e.stack,
        });
        return { error: e.message, connected: false, originalError: e };
      }),
      getGoogleDocsToken(userId).catch((e) => {
        console.error("Error fetching Google Docs token:", e);
        return { error: e.message, connected: false };
      }),
      getZoomToken(userId).catch((e) => {
        console.error("Error fetching Zoom token:", e);
        return { error: e.message, connected: false };
      }),
      getCRMToken(userId).catch((e) => {
        console.error("Error fetching CRM token:", e);
        return { error: e.message, connected: false };
      }),
    ]);

    // Process token responses
    const processConnection = (response: any) => {
      // First, add more detailed debug logging to see exactly what we're receiving
      console.log(
        `Processing connection response:`,
        JSON.stringify(response, null, 2)
      );

      // Return disconnected status if response is null or undefined
      if (!response) {
        console.log(
          "Connection response is null or undefined - marking as disconnected"
        );
        return { connected: false, status: "disconnected" };
      }

      // Explicitly handle the connection_required error
      if (
        (response.error && response.error === "connection_required") ||
        (typeof response === "object" &&
          "error" in response &&
          response.error === "connection_required")
      ) {
        console.log(
          "Connection requires authorization - marking as disconnected"
        );
        return {
          connected: false,
          status: "requires_connection",
          message: "Connection required. Please connect this service.",
        };
      }

      // Check if response has any error property
      if (
        response.error ||
        (typeof response === "object" && "error" in response)
      ) {
        const errorMessage = response.error || "Unknown error";
        console.log(
          `Connection error detected: ${errorMessage} - marking as disconnected`
        );

        return {
          connected: false,
          status: "error",
          error: errorMessage,
        };
      }

      // If response is empty object or doesn't have expected properties
      if (typeof response === "object" && Object.keys(response).length === 0) {
        return { connected: false, status: "disconnected" };
      }

      // If response has token, it's connected
      if (response.token) {
        return {
          connected: true,
          status: "connected",
          token: {
            scopes: response.token.scopes || [],
            accessToken: response.token.accessToken || "",
            accessTokenExpiry: response.token.accessTokenExpiry || "",
          },
        };
      }

      // Only mark as connected if explicitly stated
      if (response.status === "connected" || response.connected === true) {
        console.log("Connection status explicitly marked connected");
        return {
          connected: true,
          status: "connected",
        };
      }

      // Default to disconnected for any other case
      console.log(
        "Connection has no valid token or connected status - marking as disconnected"
      );
      return {
        connected: false,
        status: "disconnected",
      };
    };

    // Format the response
    const connections = {
      "google-calendar": processConnection(googleCalendar),
      "google-docs": processConnection(googleDocs),
      zoom: processConnection(zoom),
      "custom-crm": processConnection(customCrm),
    };

    trackOAuthEvent("connection_successful", {
      userId,
      action: "check_all_connections",
      googleCalendarConnected: connections["google-calendar"].connected,
      googleDocsConnected: connections["google-docs"].connected,
      zoomConnected: connections.zoom.connected,
      crmConnected: connections["custom-crm"].connected,
    });

    return Response.json({ connections });
  } catch (error) {
    console.error("Error fetching OAuth connections:", error);
    trackError(error instanceof Error ? error : new Error(String(error)));
    trackOAuthEvent("connection_failed", {
      userId,
      action: "check_all_connections",
      errorMessage: String(error),
    });
    return Response.json(
      { error: "Failed to fetch connections" },
      { status: 500 }
    );
  }
}

// Export route by ID for handling individual chats
export async function GET_BY_ID(
  request: Request,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  const userSession = await session();

  if (!userSession?.token?.sub) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    // Verify chat ownership
    const chat = await getChatById({ id });

    if (!chat) {
      return new Response("Chat not found", { status: 404 });
    }

    if (chat.userId !== userSession.token.sub) {
      return new Response("Unauthorized", { status: 403 });
    }

    // Get all messages
    const messages = await getChatMessages({ chatId: id });

    // Format messages for export
    const formattedChat = {
      title: chat.title,
      createdAt: chat.createdAt,
      messages: messages.map((message) => ({
        role: message.role,
        content: message.parts.join("\n"),
        timestamp: message.createdAt,
      })),
    };

    // For JSON format
    const jsonContent = JSON.stringify(formattedChat, null, 2);

    // For Markdown format
    let markdownContent = `# ${
      chat.title
    }\nExported on ${new Date().toLocaleString()}\n\n`;

    for (const message of messages) {
      const role = message.role === "user" ? "You" : "Assistant";
      const content = message.parts.join("\n");
      markdownContent += `## ${role} (${new Date(
        message.createdAt
      ).toLocaleString()})\n\n${content}\n\n`;
    }

    // Determine format from request
    const url = new URL(request.url);
    const format = url.searchParams.get("format") || "json";

    if (format === "markdown") {
      return new Response(markdownContent, {
        headers: {
          "Content-Type": "text/markdown",
          "Content-Disposition": `attachment; filename="${chat.title}.md"`,
        },
      });
    } else {
      return new Response(jsonContent, {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="${chat.title}.json"`,
        },
      });
    }
  } catch (error) {
    console.error("Error exporting chat:", error);
    return new Response("Failed to export chat", { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  const userSession = await session();
  const userId = userSession?.token?.sub;

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Verify chat ownership
    const chat = await getChatById({ id });

    if (!chat) {
      return Response.json({ error: "Chat not found" }, { status: 404 });
    }

    if (chat.userId !== userId) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Get sharing options from request
    const { expiresInDays } = await request.json();

    // Generate share ID
    const shareId = nanoid(10); // Short, URL-friendly ID

    // Calculate expiration date if provided
    let expiresAt = undefined;
    if (expiresInDays && !isNaN(expiresInDays)) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    }

    // Store sharing information (in a real app, this would be in a database)
    sharedChats[shareId] = {
      chatId: id,
      userId,
      expiresAt,
    };

    // Generate share URL
    const shareUrl = `${
      process.env.NEXT_PUBLIC_BASE_URL || ""
    }/shared/${shareId}`;

    return Response.json({ shareId, shareUrl, expiresAt });
  } catch (error) {
    console.error("Error sharing chat:", error);
    return Response.json({ error: "Failed to share chat" }, { status: 500 });
  }
}

// Route to get a shared chat
export async function GET_SHARED(
  request: Request,
  { params }: { params: { id: string } }
) {
  const shareId = params.id;

  const sharedChat = sharedChats[shareId];

  if (!sharedChat) {
    return Response.json({ error: "Shared chat not found" }, { status: 404 });
  }

  // Check if expired
  if (sharedChat.expiresAt && new Date() > sharedChat.expiresAt) {
    delete sharedChats[shareId]; // Clean up expired share
    return Response.json({ error: "Shared chat has expired" }, { status: 410 });
  }

  // In a real implementation, you would fetch the chat and its messages here
  return Response.json({ chatId: sharedChat.chatId });
}

interface ModelConfig {
  name: string;
  provider: string;
  maxTokens?: number;
  temperature?: number;
  supportsFunctions?: boolean;
  supportsVision?: boolean;
  paid?: boolean;
}

export const availableModels: Record<string, ModelConfig> = {
  "gpt-3.5-turbo": {
    name: "GPT-3.5 Turbo",
    provider: "OpenAI",
    maxTokens: 4096,
    supportsFunctions: true,
    supportsVision: false,
  },
  "gpt-4-turbo": {
    name: "GPT-4 Turbo",
    provider: "OpenAI",
    maxTokens: 128000,
    supportsFunctions: true,
    supportsVision: true,
    paid: true,
  },
  "gpt-4o": {
    name: "GPT-4o",
    provider: "OpenAI",
    maxTokens: 128000,
    supportsFunctions: true,
    supportsVision: true,
    paid: true,
  },
  "claude-3-haiku": {
    name: "Claude 3 Haiku",
    provider: "Anthropic",
    maxTokens: 200000,
    supportsFunctions: true,
    supportsVision: true,
  },
  "claude-3-sonnet": {
    name: "Claude 3 Sonnet",
    provider: "Anthropic",
    maxTokens: 200000,
    supportsFunctions: true,
    supportsVision: true,
    paid: true,
  },
  "llama-3-8b": {
    name: "Llama 3 8B",
    provider: "Groq",
    maxTokens: 8192,
    supportsFunctions: false,
    supportsVision: false,
  },
};

// Define a custom provider that implements the required interface
export const myProvider: Provider = {
  languageModel: ((model: string) => {
    // OpenAI models
    if (model.includes("gpt-")) {
      return openaiSDK(model);
    }

    // Anthropic models
    if (model.startsWith("claude-")) {
      return anthropic(model);
    }

    // Groq models
    if (model.startsWith("llama-")) {
      return groq(model);
    }

    // Default to GPT-3.5 if no match
    return openaiSDK("gpt-3.5-turbo");
  }) as Provider["languageModel"],

  textEmbeddingModel: () => {
    throw new Error("Text embedding model not implemented");
  },

  imageModel: () => {
    throw new Error("Image model not implemented");
  },
};

export interface SystemPromptOptions {
  selectedChatModel?: string;
  withTools?: boolean;
  withMultimodal?: boolean;
}

export function systemPrompt({
  selectedChatModel,
  withTools = true,
  withMultimodal = false,
}: SystemPromptOptions = {}) {
  // Base prompt for all models
  let basePrompt = `You are a helpful CRM assistant that helps users access and manage their CRM data. 
      
Important guidelines:
1. For CRM-related queries, clearly check if CRM access is available before attempting to provide data
2. NEVER make up or hallucinate names, companies, or CRM data when access is not available
3. When CRM connection is needed, tell the user clearly they need to connect their CRM
4. Refer only to entities explicitly mentioned by the user (like "Acme Corp") - don't introduce random names like "John" or "Alice"
5. For connection requests, a button will appear in the UI - tell users they can click to connect

You have access to tools for CRM data, calendar management, and document creation.`;

  // Add model-specific instructions
  if (selectedChatModel?.includes("gpt-4")) {
    basePrompt += `\n\nYou are using GPT-4, so you can provide more detailed analyses and insights. When working with CRM data, look for patterns and offer strategic recommendations when appropriate.`;
  }

  if (selectedChatModel?.includes("claude")) {
    basePrompt += `\n\nYou are using Claude, which excels at understanding nuanced queries. Take time to fully understand what the user is trying to accomplish with their CRM data before responding.`;
  }

  // Add multimodal instructions if the model supports it
  if (withMultimodal) {
    basePrompt += `\n\nYou can receive and analyze images. When analyzing screenshots of CRM data, describe what you see accurately without making assumptions about data that isn't visible.`;
  }

  return basePrompt;
}

export async function fetchWithRetry<T>(
  url: string,
  options: RequestInit,
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

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
