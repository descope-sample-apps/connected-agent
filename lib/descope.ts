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
 * Fetches an OAuth token for a specific provider and user from Descope
 */
export async function getOAuthToken(
  userId: string,
  appId: string,
  scopes: string[],
  options: TokenOptions = { withRefreshToken: false, forceRefresh: true }
): Promise<TokenResponse | null> {
  console.log(`getOAuthToken called for userId: ${userId}, appId: ${appId}`);

  const managementKey = process.env.DESCOPE_MANAGEMENT_KEY;
  const projectId = process.env.NEXT_PUBLIC_DESCOPE_PROJECT_ID;

  if (!managementKey || !projectId) {
    console.error("Missing Descope credentials");
    return null;
  }

  console.log("scopes:", scopes);

  try {
    const response = await fetch(
      "https://api.descope.com/v1/mgmt/outbound/app/user/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${projectId}:${managementKey}`,
        },
        body: JSON.stringify({
          appId,
          userId,
          scopes,
          options,
        }),
      }
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
            requiredScopes: scopes,
          },
        }
      );

      return {
        error: "connection_required",
        provider: appId,
        requiredScopes: scopes,
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
    console.log("tokenData:", tokenData);

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
 * Enhanced OAuth token getter with scope validation and dynamic scope requirements
 */
export async function getOAuthTokenWithScopeValidation(
  userId: string,
  appId: string,
  operation: string,
  options: TokenOptions = { withRefreshToken: false, forceRefresh: true }
): Promise<TokenResponse> {
  // Get required scopes from OpenAPI spec
  const requiredScopes = await getRequiredScopes(appId, operation);

  // Try to get token with required scopes
  const tokenData = await getOAuthToken(userId, appId, requiredScopes, options);

  if (!tokenData) {
    return {
      error: "connection_required",
      provider: appId,
      requiredScopes,
    };
  }

  // If we got a token, validate scopes
  if (
    !("error" in tokenData) &&
    !hasRequiredScopes(tokenData, requiredScopes)
  ) {
    return {
      error: "insufficient_scopes",
      provider: appId,
      requiredScopes,
      currentScopes: tokenData.token?.scopes || [],
    };
  }

  return tokenData;
}

/**
 * Provider-specific token fetchers with operation-based scope requirements
 */

export async function getGoogleCalendarToken(
  userId: string,
  operation: string = "events.list"
) {
  return getOAuthTokenWithScopeValidation(
    userId,
    "google-calendar",
    operation,
    {
      withRefreshToken: false,
      forceRefresh: true,
    }
  );
}

export async function getGoogleDocsToken(
  userId: string,
  operation: string = "documents.get"
) {
  return getOAuthTokenWithScopeValidation(userId, "google-docs", operation, {
    withRefreshToken: false,
    forceRefresh: true,
  });
}

export async function getCRMToken(
  userId: string,
  operation: string = "contacts.list"
) {
  return getOAuthTokenWithScopeValidation(userId, "custom-crm", operation, {
    withRefreshToken: false,
    forceRefresh: true,
  });
}

export async function getZoomToken(
  userId: string,
  operation: string = "meetings.create"
) {
  return getOAuthTokenWithScopeValidation(userId, "zoom", operation, {
    withRefreshToken: false,
    forceRefresh: true,
  });
}
