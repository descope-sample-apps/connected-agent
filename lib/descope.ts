/**
 * Utility functions for interacting with Descope API
 */

import { getRequiredScopes, getToolScopes } from "./openapi-utils";
import { trackToolAction } from "./oauth-utils";

type TokenOptions = {
  withRefreshToken?: boolean;
  forceRefresh?: boolean;
};

type TokenResponse =
  | {
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
  | {
      error:
        | "connection_required"
        | "insufficient_scopes"
        | "Too Many Requests";
      provider: string;
      requiredScopes: string[];
      currentScopes?: string[];
    };

/**
 * Gets an OAuth token for a specific provider and user from Descope
 * @param userId The user ID
 * @param appId The provider ID (e.g., "google-calendar")
 * @param operation The operation to perform (e.g., "events.list" or "check_connection")
 * @param options Token options
 * @param toolId Optional tool ID to use for scope lookup
 * @returns Token response or null if error
 */
export async function getOAuthToken(
  userId: string,
  appId: string,
  operation: string = "check_connection",
  options: TokenOptions = { withRefreshToken: false, forceRefresh: true },
  toolId?: string
): Promise<TokenResponse | null> {
  const managementKey = process.env.DESCOPE_MANAGEMENT_KEY;
  const projectId = process.env.NEXT_PUBLIC_DESCOPE_PROJECT_ID;

  if (!managementKey || !projectId) {
    console.error("Missing Descope credentials");
    return null;
  }

  let scopes: string[] | undefined = undefined;

  if (operation === "check_connection") {
    scopes = await getToolScopes(appId, "connect", toolId);
  } else {
    scopes = await getToolScopes(appId, operation, toolId);
  }

  // Log scope resolution result
  console.log(
    `[getOAuthToken] Resolved scopes for ${appId}:${operation}:`,
    scopes
  );

  // Prepare the request body
  const requestBody = {
    appId,
    userId,
    // Only include scopes if they are explicitly provided and non-empty
    ...(scopes && scopes.length > 0 && { scopes }),
    options,
  };

  const baseUrl = process.env.DESCOPE_BASE_URL || "https://api.descope.com";

  try {
    const response = await fetch(`${baseUrl}/v1/mgmt/outbound/app/user/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${projectId}:${managementKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    const clonedResponse = response.clone();
    const responseText = await clonedResponse.text();

    if (response.status === 404) {
      trackToolAction(
        userId,
        {
          action: "token_request",
          provider: appId,
          parameters: { scopes, options },
        },
        {
          success: false,
          details: {
            error: "connection_required",
            requiredScopes: scopes || [],
          },
        }
      );

      return {
        error: "connection_required",
        provider: appId,
        requiredScopes: scopes || [],
      };
    }

    if (!response.ok) {
      console.error(
        `Failed to get OAuth token for ${appId}: ${response.statusText}`
      );

      // Handle rate limit errors specifically
      if (response.status === 429) {
        trackToolAction(
          userId,
          {
            action: "token_request",
            provider: appId,
            parameters: { scopes, options },
          },
          {
            success: false,
            details: {
              error: "Too Many Requests",
              errorCode: "429",
            },
          }
        );

        return {
          error: "Too Many Requests",
          provider: appId,
          requiredScopes: scopes || [],
        };
      }

      trackToolAction(
        userId,
        {
          action: "token_request",
          provider: appId,
          parameters: { scopes, options },
        },
        {
          success: false,
          details: {
            error: response.statusText,
            errorCode: response.status.toString(),
          },
        }
      );

      return null;
    }

    // Parse the token data from the response text we already have
    const tokenData = responseText
      ? JSON.parse(responseText)
      : await response.json();

    trackToolAction(
      userId,
      {
        action: "token_request",
        provider: appId,
        parameters: { scopes, options },
      },
      {
        success: true,
        details: {
          scopes: tokenData.token.scopes,
          expiresIn:
            parseInt(tokenData.token.accessTokenExpiry) -
            Math.floor(Date.now() / 1000),
        },
      }
    );

    return tokenData;
  } catch (error) {
    console.error("Error fetching OAuth token:", error);

    trackToolAction(
      userId,
      {
        action: "token_request",
        provider: appId,
        parameters: { scopes, options },
      },
      {
        success: false,
        details: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      }
    );

    return null;
  }
}

/**
 * Checks if a token has all required scopes
 */
export function hasRequiredScopes(
  tokenData: TokenResponse,
  requiredScopes: string[]
): boolean {
  if (!tokenData || "error" in tokenData || !tokenData.token?.scopes) {
    return false;
  }

  const tokenScopes = tokenData.token.scopes;
  return requiredScopes.every((scope) => tokenScopes.includes(scope));
}

/**
 * Provider-specific token fetchers with operation-based scope requirements
 */

export async function getGoogleCalendarToken(
  userId: string,
  operation: string = "check_connection"
) {
  return getOAuthToken(userId, "google-calendar", operation, {
    withRefreshToken: false,
  });
}

export async function getGoogleDocsToken(
  userId: string,
  operation: string = "check_connection"
) {
  return getOAuthToken(userId, "google-docs", operation, {
    withRefreshToken: false,
  });
}

export async function getCRMToken(
  userId: string,
  operation: string = "check_connection"
) {
  console.log(
    `[getCRMToken] Fetching token for userId=${userId}, operation=${operation}`
  );
  const token = await getOAuthToken(userId, "custom-crm", operation);

  // Log token response details to help debug scope issues
  if (!token) {
    console.log(`[getCRMToken] No token returned`);
  } else if ("error" in token) {
    console.log(`[getCRMToken] Token error: ${token.error}`, {
      requiredScopes: token.requiredScopes || [],
      currentScopes: token.currentScopes || [],
    });
  } else {
    console.log(
      `[getCRMToken] Token successfully retrieved with scopes:`,
      token.token.scopes
    );
  }

  return token;
}

export async function getGoogleMeetToken(
  userId: string,
  operation: string = "check_connection"
) {
  return getOAuthToken(userId, "google-meet", operation, {
    withRefreshToken: false,
  });
}

// Add Slack token function
export async function getSlackToken(
  userId: string,
  operation: string = "check_connection"
) {
  return getOAuthToken(userId, "slack", operation, {
    withRefreshToken: false,
  });
}
