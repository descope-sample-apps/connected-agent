import { getOAuthToken } from "@/lib/descope";
import { trackOAuthEvent, trackError } from "./analytics";

interface OAuthConnectParams {
  appId: string;
  redirectUrl: string;
  scopes: string[];
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

// Type definitions
interface ProviderConfig {
  openApiUrl: string;
  scopes: string[];
}

interface OperationMapping {
  path: string;
  method: string;
  scopes: string[];
}

// Cache for OpenAPI specs and operation mappings
const specCache: Record<string, any> = {};
const operationCache: Record<string, OperationMapping> = {};

// Provider configurations with OpenAPI spec URLs and fallback scopes
const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  "google-calendar": {
    openApiUrl:
      "https://raw.githubusercontent.com/APIs-guru/openapi-directory/main/APIs/googleapis.com/calendar/v3/openapi.yaml",
    scopes: [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/calendar.readonly",
    ],
  },
  "google-docs": {
    openApiUrl:
      "https://raw.githubusercontent.com/APIs-guru/openapi-directory/main/APIs/googleapis.com/docs/v1/openapi.yaml",
    scopes: [
      "https://www.googleapis.com/auth/documents",
      "https://www.googleapis.com/auth/documents.readonly",
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/drive.file",
    ],
  },
  zoom: {
    openApiUrl:
      "https://raw.githubusercontent.com/APIs-guru/openapi-directory/main/APIs/zoom.us/meeting/v2/openapi.yaml",
    scopes: [
      "meeting:write",
      "meeting:write:admin",
      "meeting:read",
      "meeting:read:admin",
      "user:read:admin",
      "user:write:admin",
      "recording:read",
      "recording:write",
      "webinar:read:admin",
      "webinar:write:admin",
    ],
  },
  salesforce: {
    openApiUrl:
      "https://raw.githubusercontent.com/APIs-guru/openapi-directory/main/APIs/salesforce.com/v57.0/openapi.yaml",
    scopes: [
      "api",
      "refresh_token",
      "full",
      "web",
      "openid",
      "profile",
      "email",
      "address",
      "phone",
    ],
  },
  hubspot: {
    openApiUrl:
      "https://raw.githubusercontent.com/APIs-guru/openapi-directory/main/APIs/hubapi.com/crm/v3/openapi.yaml",
    scopes: [
      "crm.objects.contacts.read",
      "crm.objects.contacts.write",
      "crm.objects.deals.read",
      "crm.objects.deals.write",
      "content",
      "files",
      "forms",
      "tickets",
    ],
  },
  microsoft: {
    openApiUrl:
      "https://raw.githubusercontent.com/APIs-guru/openapi-directory/main/APIs/microsoft.com/graph/v1.0/openapi.yaml",
    scopes: [
      "Calendars.ReadWrite",
      "Calendars.Read",
      "Mail.ReadWrite",
      "Mail.Read",
      "User.Read",
      "Files.ReadWrite",
      "offline_access",
    ],
  },
  "custom-crm": {
    openApiUrl:
      "https://raw.githubusercontent.com/APIs-guru/openapi-directory/main/APIs/custom-crm.com/v1/openapi.yaml",
    scopes: ["api", "refresh_token"],
  },
};

async function fetchOpenApiSpec(provider: string): Promise<any> {
  // Check cache first
  if (specCache[provider]) {
    return specCache[provider];
  }

  const config = PROVIDER_CONFIGS[provider];
  if (!config) {
    throw new Error(`No OpenAPI spec URL defined for provider: ${provider}`);
  }

  try {
    const response = await fetch(config.openApiUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch OpenAPI spec: ${response.statusText}`);
    }
    const spec = await response.json();

    // Cache the spec
    specCache[provider] = spec;
    return spec;
  } catch (error) {
    console.error(`Error fetching OpenAPI spec for ${provider}:`, error);
    throw error;
  }
}

async function getOperationMapping(
  providerId: string,
  operationId: string
): Promise<OperationMapping> {
  const cacheKey = `${providerId}:${operationId}`;

  // Check cache first
  if (operationCache[cacheKey]) {
    return operationCache[cacheKey];
  }

  try {
    const spec = await fetchOpenApiSpec(providerId);

    // Extract operation details from OpenAPI spec
    const operation =
      spec.paths[operationId]?.get ||
      spec.paths[operationId]?.post ||
      spec.paths[operationId]?.put ||
      spec.paths[operationId]?.delete ||
      spec.paths[operationId]?.patch;

    if (!operation) {
      throw new Error(
        `No operation mapping found for ${providerId}:${operationId}`
      );
    }

    // Extract required scopes from the operation's security requirements
    const scopes =
      operation.security?.[0]?.oauth2 || PROVIDER_CONFIGS[providerId].scopes;

    const mapping: OperationMapping = {
      path: operationId,
      method: Object.keys(operation)[0].toUpperCase(),
      scopes,
    };

    // Cache the mapping
    operationCache[cacheKey] = mapping;
    return mapping;
  } catch (error) {
    console.error(
      `Error getting operation mapping for ${providerId}:${operationId}:`,
      error
    );
    throw error;
  }
}

export async function validateAndRequestToken(
  appId: string,
  scopes: string[]
): Promise<TokenResponse | null> {
  try {
    // Get the DSR from localStorage
    const dsr = localStorage.getItem("dsr");

    // Prepare headers with DSR if available
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (dsr) {
      headers[
        "Authorization"
      ] = `Bearer ${process.env.NEXT_PUBLIC_DESCOPE_PROJECT_ID}:${dsr}`;
    }

    // Request token with specific scopes
    const response = await fetch(
      "https://api.descope.com/v1/outbound/oauth/token",
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          appId,
          scopes,
        }),
      }
    );

    if (response.status === 404) {
      // Token doesn't exist or scopes are insufficient
      return null;
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to validate token");
    }

    return response.json();
  } catch (error) {
    console.error("Error validating token:", error);
    throw error;
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

    const requestBody = {
      appId,
      options: {
        redirectUrl,
        scopes,
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

interface OAuthPopupOptions {
  onSuccess: () => void;
  onError: (error: Error) => void;
  redirectTo?: string;
}

export function handleOAuthPopup(
  url: string,
  { onSuccess, onError, redirectTo }: OAuthPopupOptions
) {
  // Create popup window for OAuth flow
  const popup = window.open(
    "about:blank",
    "Connect Provider",
    "width=600,height=700"
  );
  if (!popup) {
    throw new Error("Popup blocked. Please allow popups for this site.");
  }

  // Redirect the popup to the authorization URL
  popup.location.href = url;

  // Check URL periodically to detect redirect
  const checkPopupUrl = setInterval(() => {
    try {
      const popupUrl = new URL(popup.location.href);
      const searchParams = new URLSearchParams(popupUrl.search);

      // Check if we've been redirected back to our app
      if (popupUrl.origin === window.location.origin) {
        clearInterval(checkPopupUrl);

        // Check for OAuth success
        if (searchParams.get("oauth") === "success") {
          // Send success message to parent
          popup.postMessage({ type: "oauth_success" }, window.location.origin);

          // Close popup after a short delay
          setTimeout(() => {
            popup.close();
          }, 500);

          onSuccess();
        } else {
          // Handle error case
          const error = searchParams.get("error");
          onError(new Error(error || "OAuth connection failed"));
        }
      }
    } catch (error) {
      // Ignore cross-origin errors while popup is on provider's domain
    }
  }, 500);

  // Cleanup interval if popup is closed
  const checkPopupClosed = setInterval(() => {
    if (popup.closed) {
      clearInterval(checkPopupUrl);
      clearInterval(checkPopupClosed);
    }
  }, 500);
}

// Export the operation mapping function for use in tools
export { getOperationMapping };

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
          link: `https://docs.google.com/document/d/${actionResult.details.documentId}`,
          title: actionResult.details.documentTitle || "Document",
        };
        break;
      case "create_event":
        actionResult.details = {
          ...actionResult.details,
          link: `https://calendar.google.com/calendar/event?eid=${actionResult.details.eventId}`,
          title: actionResult.details.title || "Calendar Event",
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

export function getToolActions(userId: string): ToolActionResult[] {
  // Try to get from cache first
  if (toolActionCache[userId]) {
    return toolActionCache[userId];
  }

  // If not in cache and in browser environment, try localStorage
  if (isBrowser) {
    try {
      const userActions = localStorage.getItem(`tool_actions_${userId}`);
      if (userActions) {
        const actions = JSON.parse(userActions);
        toolActionCache[userId] = actions;
        return actions;
      }
    } catch (error) {
      console.error("Error reading tool actions from localStorage:", error);
    }
  }

  return [];
}

export function getRecentToolActions(
  userId: string,
  limit: number = 5
): ToolActionResult[] {
  const actions = getToolActions(userId);
  return actions.slice(-limit);
}

export async function getOAuthTokenWithScopeValidation(
  userId: string,
  provider: string,
  options: OAuthOptions
): Promise<OAuthResponse> {
  const startTime = Date.now();

  try {
    // Get token from Descope (it handles refresh automatically)
    const token = await getOAuthToken(userId, provider, options.scopes);

    // Track token request
    trackOAuthEvent("token_request", {
      userId,
      provider,
      success: !!token && !("error" in token),
      duration: Date.now() - startTime,
      scopes: options.scopes,
    });

    // Check for errors
    if (!token || "error" in token) {
      trackOAuthEvent("token_error", {
        userId,
        provider,
        error: "error" in token ? token.error : "No token returned",
        scopes: options.scopes,
      });

      return {
        error: "error" in token! ? token.error : "Failed to get OAuth token",
        provider,
        requiredScopes: options.scopes,
      };
    }

    // Validate scopes
    if (!hasRequiredScopes(token, options.scopes)) {
      trackOAuthEvent("scope_validation_failed", {
        userId,
        provider,
        requiredScopes: options.scopes,
        currentScopes: token?.token?.scopes || [],
      });

      return {
        error: "Invalid scopes",
        provider,
        requiredScopes: options.scopes,
        currentScopes: token?.token?.scopes || [],
      };
    }

    return token;
  } catch (error) {
    trackError(error as Error, {
      userId,
      provider,
      scopes: options.scopes,
      function: "getOAuthTokenWithScopeValidation",
    });

    console.error(`Error getting OAuth token for ${provider}:`, error);
    return {
      error:
        error instanceof Error ? error.message : "Failed to get OAuth token",
      provider,
    };
  }
}

function extractScopesFromOpenAPI(spec: any): string[] {
  const scopes: string[] = [];

  // Check security schemes for OAuth2 scopes
  if (spec.components?.securitySchemes) {
    Object.values(spec.components.securitySchemes).forEach((scheme: any) => {
      if (scheme.type === "oauth2" && scheme.flows) {
        Object.values(scheme.flows).forEach((flow: any) => {
          if (flow.scopes) {
            scopes.push(...Object.keys(flow.scopes));
          }
        });
      }
    });
  }

  // Check global security requirements
  if (spec.security) {
    spec.security.forEach((security: any) => {
      Object.entries(security).forEach(([scheme, scopesList]) => {
        if (Array.isArray(scopesList)) {
          scopes.push(...scopesList);
        }
      });
    });
  }

  return [...new Set(scopes)]; // Remove duplicates
}

async function fetchWellKnownConfig(provider: string): Promise<any> {
  const wellKnownUrls: Record<string, string> = {
    google: "https://accounts.google.com/.well-known/openid-configuration",
    zoom: "https://zoom.us/.well-known/oauth-authorization-server",
    // Add other providers as needed
  };

  const url = wellKnownUrls[provider];
  if (!url) {
    throw new Error(`No well-known URL configured for provider: ${provider}`);
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch well-known config: ${response.statusText}`
    );
  }

  return response.json();
}

function hasRequiredScopes(
  token: TokenResponse,
  requiredScopes: string[]
): boolean {
  const tokenScopes = token.token.scopes || [];
  return requiredScopes.every((scope) => tokenScopes.includes(scope));
}
