import { getOAuthToken } from "@/lib/descope";
import { trackOAuthEvent, trackError } from "./analytics";

interface OAuthConnectParams {
  appId: string;
  redirectUrl: string;
  scopes?: string[]; // Optional - only passed when specific scopes are needed
}

interface TokenResponse {
  token: {
    id: string;
    appId: string;
    userId: string;
    tokenSub: string;
    accessToken: string;
    accessTokenType: string;
    accessTokenExpiry: string;
    hasRefreshToken: boolean;
    refreshToken: string;
    lastRefreshTime: string;
    lastRefreshError: string;
    scopes: string[];
  };
}

interface OAuthErrorResponse {
  error: string;
  provider?: string;
  requiredScopes?: string[];
  currentScopes?: string[];
}

type OAuthResponse = TokenResponse | OAuthErrorResponse;

interface OAuthOptions {
  appId: string;
  userId: string;
  scopes: string[];
  options?: Record<string, any>;
}

export async function getOAuthTokenWithScopeValidation(
  userId: string,
  provider: string,
  options: OAuthOptions
): Promise<OAuthResponse> {
  try {
    // Get token from Descope (it handles refresh automatically)
    const token = await getOAuthToken(
      userId,
      provider,
      options.scopes.join(",")
    );

    // If token is null, return error response
    if (!token) {
      return {
        error: "Failed to get OAuth token",
        provider,
        requiredScopes: options.scopes,
      };
    }

    // Check if token has an error property
    if (typeof token === "object" && "error" in token) {
      return {
        error: token.error,
        provider,
        requiredScopes: options.scopes,
      };
    }

    // If we have a valid token, return it
    return token;
  } catch (error) {
    console.error(`Error getting OAuth token for ${provider}:`, error);
    return {
      error:
        error instanceof Error ? error.message : "Failed to get OAuth token",
      provider,
    };
  }
}

export async function connectToOAuthProvider({
  appId,
  redirectUrl,
  scopes,
}: OAuthConnectParams) {
  try {
    // Get refresh token from localStorage if available
    const refreshToken = localStorage.getItem("DSR");
    console.log(
      "Retrieved refresh token:",
      refreshToken ? "Present" : "Not found"
    );

    // Ensure we have a valid redirect URL
    if (!redirectUrl) {
      throw new Error("Redirect URL is required");
    }

    // Extract redirectTo from the redirectUrl if present
    const redirectUrlObj = new URL(redirectUrl);
    const redirectTo = redirectUrlObj.searchParams.get("redirectTo") || "chat";

    // Create a state parameter that includes the redirectTo
    const state = JSON.stringify({ redirectTo });

    // Only include scopes in the request if they are explicitly provided
    const requestBody = {
      appId,
      options: {
        redirectUrl,
        state,
        ...(scopes && scopes.length > 0 ? { scopes } : {}),
      },
    };

    console.log("Preparing request to Descope:", {
      url: "/api/oauth/connect",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(refreshToken && { "X-Refresh-Token": refreshToken }),
      },
      body: requestBody,
    });

    // Call our backend route to initiate the OAuth connection
    const response = await fetch("/api/oauth/connect", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(refreshToken && { "X-Refresh-Token": refreshToken }),
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Descope API error response:", {
        status: response.status,
        statusText: response.statusText,
        error,
      });
      throw new Error(error.message || "Failed to initiate OAuth connection");
    }

    const { url } = await response.json();
    console.log("Successfully received authorization URL from Descope");
    return url;
  } catch (error) {
    console.error("Error connecting to OAuth provider:", error);
    throw error;
  }
}

export async function handleOAuthPopup(authUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const popup = window.open(authUrl, "oauth-popup", "width=600,height=600");
    if (!popup) {
      reject(new Error("Failed to open popup window"));
      return;
    }

    const checkInterval = setInterval(() => {
      try {
        const url = popup.location.href;
        if (url.includes("oauth=success")) {
          clearInterval(checkInterval);
          popup.close();
          resolve();
        } else if (url.includes("oauth=error")) {
          clearInterval(checkInterval);
          popup.close();
          const error = new URL(url).searchParams.get("error");
          reject(new Error(error || "OAuth error"));
        }
      } catch (e) {
        // Cross-origin error, popup is still on the OAuth provider's domain
      }
    }, 100);

    // Clean up interval if popup is closed
    popup.onbeforeunload = () => {
      clearInterval(checkInterval);
    };
  });
}

export interface ToolActionResult {
  success: boolean;
  action: string;
  provider: string;
  details: {
    // Common fields
    title?: string;
    description?: string;
    link?: string;
    // Calendar-specific fields
    startTime?: string;
    endTime?: string;
    attendees?: string[];
    eventId?: string;
    // Document-specific fields
    documentId?: string;
    documentTitle?: string;
    // Meeting-specific fields
    meetingId?: string;
    meetingUrl?: string;
    // CRM-specific fields
    dealId?: string;
    contactId?: string;
    accountId?: string;
    // Token-specific fields
    scopes?: string[];
    expiresIn?: number;
    requiredScopes?: string[];
    // Error details
    error?: string;
    errorCode?: string;
  };
  timestamp: string;
}

export interface ToolActionContext {
  action: string;
  provider: string;
  parameters: Record<string, any>;
}

// Cache for tool action results
const toolActionCache: Record<string, ToolActionResult[]> = {};

// Helper to check if we're in a browser environment
const isBrowser = typeof window !== "undefined";

export function trackToolAction(
  userId: string,
  context: ToolActionContext,
  result: Omit<ToolActionResult, "timestamp" | "provider" | "action">
): ToolActionResult {
  const actionResult: ToolActionResult = {
    ...result,
    provider: context.provider,
    action: context.action,
    timestamp: new Date().toISOString(),
  };

  // Format the details based on the action type
  if (actionResult.success) {
    switch (actionResult.action) {
      case "schedule_meeting":
        actionResult.details = {
          ...actionResult.details,
          link: actionResult.details.meetingUrl || actionResult.details.link,
          title: actionResult.details.title || "Meeting",
        };
        break;
      case "create_document":
        actionResult.details = {
          ...actionResult.details,
          link: actionResult.details.documentId
            ? `https://docs.google.com/document/d/${actionResult.details.documentId}`
            : undefined,
          title: actionResult.details.documentTitle || "Document",
        };
        break;
    }
  }

  // Initialize cache for user if not exists
  if (!toolActionCache[userId]) {
    toolActionCache[userId] = [];
  }

  // Add to cache
  toolActionCache[userId].push(actionResult);

  // Only use localStorage in browser environment
  if (isBrowser) {
    try {
      const userActions = JSON.parse(
        localStorage.getItem(`tool_actions_${userId}`) || "[]"
      );
      userActions.push(actionResult);
      localStorage.setItem(
        `tool_actions_${userId}`,
        JSON.stringify(userActions)
      );
    } catch (error) {
      console.error("Error storing tool actions in localStorage:", error);
    }
  }

  return actionResult;
}
