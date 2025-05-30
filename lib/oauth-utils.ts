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
    toolId?: string; // Optional toolId for scope lookup
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
  scopes?: string[]; // Make scopes optional
  options?: Record<string, any>;
  operation?: string; // Added to support tool_calling operation
  toolId?: string; // Added to support tool-specific scope lookup
}

// Add default scopes for providers when none are specified
export const DEFAULT_SCOPES: Record<string, string[]> = {
  "google-calendar": ["https://www.googleapis.com/auth/calendar"],
  "google-docs": ["https://www.googleapis.com/auth/drive.file"],
  "google-meet": [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/meetings.space.created",
  ],
  "custom-crm": ["contacts:read", "deals:read", "openid"],
  slack: ["chat:write", "channels:manage", "users:read"],
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
      toolId: options.toolId || "none",
    });

    // Get token from Descope (it handles refresh automatically)
    const token = await getOAuthToken(
      userId,
      provider,
      options.operation || "check_connection",
      { withRefreshToken: false },
      options.toolId // Pass toolId for scope lookup
    );

    console.log("[OAuth] Token response:", {
      hasToken: !!token,
      hasError: token && "error" in token,
      provider,
      requiredScopes:
        token && "requiredScopes" in token ? token.requiredScopes : null,
      currentScopes:
        token && "currentScopes" in token ? token.currentScopes : null,
      error: token && "error" in token ? token.error : null,
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
      const requiredScopes = token.requiredScopes || options.scopes || [];
      console.log(
        `[OAuth] Returning error with required scopes:`,
        requiredScopes
      );

      return {
        error: token.error,
        provider: options.appId,
        requiredScopes: requiredScopes,
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
    let stateObject: { redirectTo: string; chatId?: string; toolId?: string } =
      {
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

    // Check if toolId is present in state
    const toolId = stateObject.toolId;
    if (toolId) {
      console.log("Including toolId in OAuth request:", toolId);
    }

    const stateParam = JSON.stringify(stateObject);

    // Track this OAuth connection attempt
    trackOAuthEvent("connection_initiated", {
      provider: appId,
      scopesCount: scopes?.length || 0,
      hasScopes: !!scopes && scopes.length > 0,
      hasToolId: !!toolId,
    });

    // Include scopes and toolId in the request
    const requestBody = {
      appId,
      options: {
        redirectUrl,
        state: stateParam,
        ...(scopes && { scopes }),
        ...(toolId && { toolId }), // Include toolId in options if available
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
  onClose?: () => void;
}

export async function handleOAuthPopup(
  authUrl: string,
  callbacks?: OAuthPopupCallbacks
): Promise<void> {
  return new Promise((resolve, reject) => {
    const appOrigin = window.location.origin;
    console.log("Opening OAuth popup with URL:", authUrl);

    // Calculate the center position for the popup
    const width = 800;
    const height = 800;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    // Open the popup with specific features to ensure it's a proper popup
    const popup = window.open(
      authUrl,
      "oauth-popup",
      `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,resizable=no,scrollbars=no`
    );

    if (!popup) {
      const error = new Error("Failed to open popup window");
      if (callbacks?.onError) callbacks.onError(error);
      if (callbacks?.onClose) callbacks.onClose();
      reject(error);
      return;
    }

    // Track if we've already handled the popup closure
    let isHandled = false;

    // Function to verify connection status before calling onSuccess
    const verifyConnectionAndResolve = async () => {
      try {
        // Let the caller handle the verification if they chose to
        if (callbacks?.onSuccess) {
          await callbacks.onSuccess();
        }
        // Always call onClose when popup completes
        if (callbacks?.onClose) callbacks.onClose();
        resolve();
      } catch (error) {
        console.error("Error in connection verification:", error);
        if (callbacks?.onError) {
          callbacks.onError(
            error instanceof Error ? error : new Error(String(error))
          );
        }
        // Always call onClose when popup completes
        if (callbacks?.onClose) callbacks.onClose();
        reject(error);
      }
    };

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

        verifyConnectionAndResolve();
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

          // Call onClose first since this is a manual close
          if (callbacks?.onClose) callbacks.onClose();

          // Verify connection instead of assuming success
          verifyConnectionAndResolve();
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

              verifyConnectionAndResolve();
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
        // Always call onClose on timeout
        if (callbacks?.onClose) callbacks.onClose();
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
    // Track the disconnect attempt
    trackOAuthEvent("connection_disconnect_initiated", {
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

    // Track the successful disconnect
    trackOAuthEvent("connection_disconnect_successful", {
      provider: providerId,
    });

    return data.success === true;
  } catch (error) {
    console.error("Error disconnecting OAuth provider:", error);
    trackError(error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}
