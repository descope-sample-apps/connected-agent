/**
 * Utility functions for interacting with Descope API
 */

type TokenOptions = {
  withRefreshToken?: boolean;
  forceRefresh?: boolean;
};

/**
 * Fetches an OAuth token for a specific provider and user from Descope
 */
export async function getOAuthToken(
  userId: string,
  appId: string,
  scopes: string[]
  //   options: TokenOptions = { withRefreshToken: true, forceRefresh: false }
) {
  console.log(`getOAuthToken called for userId: ${userId}, appId: ${appId}`);

  const managementKey = process.env.DESCOPE_MANAGEMENT_KEY;
  const projectId = process.env.NEXT_PUBLIC_DESCOPE_PROJECT_ID;

  if (!managementKey || !projectId) {
    console.error("Missing Descope credentials");
    throw new Error("Missing Descope credentials");
  }

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
        // options,
      }),
    }
  );

  console.log("Response:", response);

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(
      `Failed to get OAuth token: ${errorData.message || response.statusText}`
    );
  }

  return response.json();
}

/**
 * Provider-specific token fetchers
 */

export async function getGoogleCalendarToken(userId: string) {
  return getOAuthToken(userId, "google-calendar", [
    "https://www.googleapis.com/auth/calendar",
  ]);
}

export async function getGoogleContactsToken(userId: string) {
  return getOAuthToken(userId, "google-contacts", [
    "https://www.googleapis.com/auth/contacts.readonly",
  ]);
}

export async function getZoomToken(userId: string) {
  return getOAuthToken(userId, "zoom", ["meeting:write"]);
}
