import { getOAuthToken } from "@/lib/descope";
import { trackOAuthEvent, trackError } from "./analytics";
import { getRequiredScopes } from "./openapi-utils";

interface OAuthConnectParams {
  appId: string;
  redirectUrl: string;
  scopes?: string[]; // Optional - only included if provided
  state?: {
    redirectTo?: string;
    originalUrl?: string;
    chatId?: string;
    [key: string]: any;
  };
  chatId?: string; // Optional chat ID to return to after OAuth flow
}

// Add new interface for disconnection
interface OAuthDisconnectParams {
  providerId: string;
}

interface TokenResponse {
  token?: {
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
  error?: string;
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
export const DEFAULT_SCOPES: Record<string, string[]> = {
  "google-calendar": ["https://www.googleapis.com/auth/calendar"],
  "google-docs": ["https://www.googleapis.com/auth/documents"],
  "google-meet": ["https://www.googleapis.com/auth/meetings.space.created"],
  "custom-crm": ["openid", "contacts:read", "deals:read"],
};

// Add a function to get scopes from OpenAPI spec
async function getScopesFromOpenAPISpec(provider: string): Promise<string[]> {
  console.log(`[OAuth] Getting scopes from OpenAPI spec for ${provider}`);
  try {
    // Use the getRequiredScopes function from openapi-utils
    // We'll use a generic 'connect' operation which should return the basic/default
    // scopes needed for connection
    const scopes = await getRequiredScopes(provider, "connect");
    console.log(
      `[OAuth] Retrieved scopes from OpenAPI spec for ${provider}:`,
      scopes
    );
    return scopes;
  } catch (error) {
    console.error(
      `[OAuth] Error getting scopes from OpenAPI spec for ${provider}:`,
      error
    );
    return [];
  }
}

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
      console.error(`No token received for ${options.appId}`);
      return {
        error: "connection_required",
        provider: options.appId,
        requiredScopes: options.scopes || [],
      };
    }

    // Check if token has an error property
    if ("error" in token) {
      console.error(`Token error for ${options.appId}: ${token.error}`);
      return {
        error: token.error,
        provider: options.appId,
        requiredScopes: token.requiredScopes || options.scopes || [],
        currentScopes: token.currentScopes,
      };
    }
    return {
      token: token.token,
      provider: options.appId,
    };
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
  state,
  chatId,
}: OAuthConnectParams & { chatId?: string }) {
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

    // Create a state parameter that includes the redirectTo and any other state
    let stateObject: { redirectTo: string; chatId?: string } = {
      redirectTo: "chat",
    };

    // If we have a chat ID, include it in the state for returning to the same chat
    if (chatId) {
      stateObject = { ...stateObject, chatId };
      console.log("Including chat ID in OAuth state:", chatId);
    }

    // Add any additional state parameters if provided
    if (state) {
      stateObject = { ...stateObject, ...state };
    }

    const stateParam = JSON.stringify(stateObject);

    // Track this OAuth connection attempt
    trackOAuthEvent("connect_initiated", {
      provider: appId,
      scopesCount: scopes?.length || 0,
      hasScopes: !!scopes && scopes.length > 0,
    });

    // Include scopes in the request only if provided
    const requestBody = {
      appId,
      options: {
        redirectUrl,
        state: stateParam,
        ...(scopes && { scopes }),
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
    trackError(error instanceof Error ? error : new Error(String(error)));
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

    // Open the popup with specific features to ensure it's a proper popup
    const popup = window.open(
      authUrl,
      "oauth-popup",
      "width=600,height=600,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes"
    );

    if (!popup) {
      const error = new Error("Failed to open popup window");
      if (callbacks?.onError) callbacks.onError(error);
      reject(error);
      return;
    }

    // Track if we've already handled the popup closure
    let isHandled = false;

    // Setup message listener for the postMessage from the popup
    const messageHandler = (event: MessageEvent) => {
      console.log(
        "Received message from popup:",
        event.origin,
        event.data?.type
      );

      // Verify origin for security
      // Use looser check for localhost development (sometimes origin can differ by port)
      const originIsValid =
        event.origin === appOrigin ||
        (event.origin.includes("localhost") && appOrigin.includes("localhost"));

      if (!originIsValid) {
        console.log("Origin mismatch:", event.origin, appOrigin);
        return;
      }

      // Check if this is our OAuth success message
      if (event.data?.type === "oauth-success") {
        console.log("Received oauth-success message from popup");
        isHandled = true;
        window.removeEventListener("message", messageHandler);
        clearInterval(checkInterval);

        // Close the popup if it's still open
        if (popup && !popup.closed) {
          popup.close();
        }

        if (callbacks?.onSuccess) callbacks.onSuccess();
        resolve();
        return;
      }
    };

    window.addEventListener("message", messageHandler);

    const checkInterval = setInterval(() => {
      if (!popup || popup.closed) {
        if (!isHandled) {
          console.log("Popup was closed manually without receiving a message");
          window.removeEventListener("message", messageHandler);
          clearInterval(checkInterval);
          isHandled = true;

          // Treat a closed popup without an explicit error as a success
          // This handles cases where the popup closed automatically after auth
          console.log("Popup closed - treating as success");
          if (callbacks?.onSuccess) callbacks.onSuccess();
          resolve();
          return;
        }
        return;
      }

      try {
        // Check if we're back on our origin - this is a fallback check
        // in case the postMessage doesn't work for some reason
        if (popup.location.origin === appOrigin) {
          // Check if we're on the oauth-redirect page - this means OAuth is complete
          if (popup.location.pathname.includes("/oauth-redirect")) {
            console.log(
              "Detected popup on oauth-redirect page - OAuth completed by Descope"
            );

            // If not already handled, mark as successful immediately
            if (!isHandled) {
              isHandled = true;
              window.removeEventListener("message", messageHandler);
              clearInterval(checkInterval);

              // Close the popup
              if (popup && !popup.closed) {
                console.log("Closing popup from parent");
                popup.close();
              }

              if (callbacks?.onSuccess) callbacks.onSuccess();
              resolve();
            }
          }
        }
      } catch (e) {
        // Cross-origin error, popup is still on the OAuth provider's domain
        // This is normal and expected during the OAuth flow
      }
    }, 100);

    // Set a timeout to prevent hanging
    setTimeout(() => {
      if (!isHandled) {
        window.removeEventListener("message", messageHandler);
        clearInterval(checkInterval);

        // Close the popup if it's still open
        if (popup && !popup.closed) {
          popup.close();
        }

        const error = new Error("Authentication timed out after 5 minutes");
        if (callbacks?.onError) callbacks.onError(error);
        reject(error);
      }
    }, 300000);
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

// Add disconnection utility function
export async function disconnectOAuthProvider({
  providerId,
}: OAuthDisconnectParams): Promise<boolean> {
  try {
    // Track disconnect initiated
    trackOAuthEvent("disconnect_initiated", {
      provider: providerId,
    });

    // Call our API endpoint to disconnect the provider
    const response = await fetch("/api/oauth/disconnect", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ providerId }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Error disconnecting provider:", errorData);
      throw new Error(errorData.error || "Failed to disconnect provider");
    }

    const data = await response.json();

    // Track disconnect success if we got a positive response
    if (data.success) {
      trackOAuthEvent("disconnect_successful", {
        provider: providerId,
      });
    }

    return data.success === true;
  } catch (error) {
    console.error("Error disconnecting OAuth provider:", error);
    trackError(error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}
