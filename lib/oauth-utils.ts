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
  operation?: string; // Added to support tool_calling operation
}

// Add default scopes for providers when none are specified
const DEFAULT_SCOPES: Record<string, string[]> = {
  "google-calendar": ["https://www.googleapis.com/auth/calendar.readonly"],
  "google-docs": ["https://www.googleapis.com/auth/documents.readonly"],
  zoom: ["meeting:read"],
  crm: ["contacts.read"],
  servicenow: ["read"],
};

export async function getOAuthTokenWithScopeValidation(
  userId: string,
  provider: string,
  options: OAuthOptions
): Promise<OAuthResponse> {
  try {
    console.log("[OAuth] Starting token validation:", {
      userId,
      provider,
      requiredScopes: options.scopes,
      operation: options.operation || "check_connection",
    });

    // Get token from Descope (it handles refresh automatically)
    const token = await getOAuthToken(
      userId,
      provider,
      options.operation || "check_connection",
      { withRefreshToken: false }
    );

    console.log("[OAuth] Token response:", {
      hasToken: !!token,
      hasError: token && "error" in token,
      provider,
    });

    // If token is null, return error response
    if (!token) {
      console.error("[OAuth] No token received");
      return {
        error: "Failed to get OAuth token",
        provider,
        requiredScopes: options.scopes,
      };
    }

    // Check if token has an error property
    if (typeof token === "object" && "error" in token) {
      console.error("[OAuth] Token error:", token.error);
      return {
        error: token.error,
        provider,
        requiredScopes: options.scopes,
      };
    }

    // If we have a valid token, return it
    console.log("[OAuth] Successfully validated token");
    return token;
  } catch (error) {
    console.error(`[OAuth] Error getting token for ${provider}:`, error);
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

    // If no scopes provided, use defaults for this provider
    let scopesToUse = scopes;
    if (!scopesToUse || scopesToUse.length === 0) {
      scopesToUse = DEFAULT_SCOPES[appId] || [];
      console.log(`Using default scopes for ${appId}:`, scopesToUse);
    }

    // Include scopes in the request
    const requestBody = {
      appId,
      options: {
        redirectUrl,
        state,
        scopes: scopesToUse,
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

export interface OAuthPopupCallbacks {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export async function handleOAuthPopup(
  authUrl: string,
  callbacks?: OAuthPopupCallbacks
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Store origin for comparison
    const appOrigin = window.location.origin;
    console.log("Opening OAuth popup with URL:", authUrl);

    const popup = window.open(authUrl, "oauth-popup", "width=600,height=600");
    if (!popup) {
      const error = new Error("Failed to open popup window");
      if (callbacks?.onError) callbacks.onError(error);
      reject(error);
      return;
    }

    // Track if we've already handled the popup closure
    let isHandled = false;

    const checkInterval = setInterval(() => {
      if (!popup || popup.closed) {
        if (!isHandled) {
          console.log("Popup was closed manually");
          clearInterval(checkInterval);
          reject(new Error("Authentication window was closed"));
        }
        return;
      }

      try {
        // First check if we're back on our origin
        if (popup.location.origin === appOrigin) {
          console.log("Popup returned to app origin:", popup.location.href);

          // Then check for success/error parameters
          const params = new URLSearchParams(popup.location.search);
          const oauthStatus = params.get("oauth");

          if (oauthStatus === "success" || oauthStatus === "error") {
            isHandled = true;
            clearInterval(checkInterval);

            // Get error message if present
            const errorMsg = params.get("error");

            // Close the popup
            popup.close();

            if (oauthStatus === "success") {
              console.log("OAuth completed successfully");
              if (callbacks?.onSuccess) callbacks.onSuccess();
              resolve();
            } else {
              console.log("OAuth failed with error:", errorMsg);
              const error = new Error(errorMsg || "OAuth error");
              if (callbacks?.onError) callbacks.onError(error);
              reject(error);
            }
          }
        }
      } catch (e) {
        // Cross-origin error, popup is still on the OAuth provider's domain
      }
    }, 100);

    // Set a timeout to prevent hanging
    setTimeout(() => {
      if (!isHandled) {
        clearInterval(checkInterval);
        popup.close();
        const error = new Error("Authentication timed out after 5 minutes");
        if (callbacks?.onError) callbacks.onError(error);
        reject(error);
      }
    }, 300000); // 5 minutes timeout
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

/**
 * Simple consolidated function to track tool actions with analytics
 */
export function trackToolAction(
  userId: string,
  request: {
    action: string;
    provider: string;
    parameters?: Record<string, any>;
  },
  result: {
    success: boolean;
    details: Record<string, any>;
  }
) {
  // In a real app, this would send the event to an analytics service
  console.log(`[Analytics] Tool Action: ${request.action}`, {
    userId,
    provider: request.provider,
    parameters: request.parameters,
    success: result.success,
    details: result.details,
    timestamp: new Date().toISOString(),
  });
}
