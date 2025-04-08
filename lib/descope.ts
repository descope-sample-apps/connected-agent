/**
 * Utility functions for interacting with Descope API
 */

import { getRequiredScopes } from "./openapi-utils";
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
      error: "connection_required" | "insufficient_scopes";
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
 * @returns Token response or null if error
 */
export async function getOAuthToken(
  userId: string,
  appId: string,
  operation: string = "check_connection",
  options: TokenOptions = { withRefreshToken: false, forceRefresh: true }
): Promise<TokenResponse | null> {
  console.log(
    `getOAuthToken called for userId: ${userId}, appId: ${appId}, operation: ${operation}`
  );

  const managementKey = process.env.DESCOPE_MANAGEMENT_KEY;
  const projectId = process.env.NEXT_PUBLIC_DESCOPE_PROJECT_ID;

  if (!managementKey || !projectId) {
    console.error("Missing Descope credentials");
    return null;
  }

  // For API operations, get required scopes from the OpenAPI spec
  let scopes: string[] | undefined = undefined;

  if (operation === "check_connection") {
    // For connection checking, get scopes from OpenAPI spec
    scopes = await getRequiredScopes(appId, "connect");
    console.log(`Using connect scopes for ${appId}:`, scopes);
  } else {
    // For specific operations, get required scopes from OpenAPI spec
    scopes = await getRequiredScopes(appId, operation);
    console.log("Required scopes for operation:", scopes);
  }

  // Prepare the request body
  const requestBody = {
    appId,
    userId,
    ...(scopes && scopes.length > 0 && { scopes }),
    options,
  };

  try {
    const response = await fetch(
      "https://api.descope.com/v1/mgmt/outbound/app/user/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${projectId}:${managementKey}`,
        },
        body: JSON.stringify(requestBody),
      }
    );

    // Log the response status
    console.log(
      `Descope OAuth token response status: ${response.status} ${response.statusText}`
    );

    if (response.status === 404) {
      // Token not found - needs to be reconnected with new scopes
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
          },
        }
      );

      return null;
    }

    const tokenData = await response.json();

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
  return getOAuthToken(userId, "custom-crm", operation, {
    withRefreshToken: false,
  });
}

export async function getZoomToken(
  userId: string,
  operation: string = "check_connection"
) {
  return getOAuthToken(userId, "zoom", operation, {
    withRefreshToken: false,
  });
}
