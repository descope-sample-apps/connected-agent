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
) {
  console.log(`getOAuthToken called for userId: ${userId}, appId: ${appId}`);

  const managementKey = process.env.DESCOPE_MANAGEMENT_KEY;
  const projectId = process.env.NEXT_PUBLIC_DESCOPE_PROJECT_ID;

  if (!managementKey || !projectId) {
    console.error("Missing Descope credentials");
    return null; // Return null instead of throwing an error
  }

  try {
    const response = await fetch(
      "https://api.descope.com/v1/mgmt/outbound/app/user/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${projectId}:${managementKey}`,
        },
        body: JSON.stringify({ appId, userId, scopes }),
      }
    );

    if (!response.ok) {
      console.error(
        `Failed to get OAuth token for ${appId}: ${response.statusText}`
      );
      return null; // Return null to indicate failure
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching OAuth token:", error);
    return null; // Return null to indicate failure
  }
}

/**
 * Provider-specific token fetchers
 */

export async function getGoogleCalendarToken(userId: string) {
  return getOAuthToken(userId, "google-calendar", [
    "https://www.googleapis.com/auth/calendar",
  ]);
}

export async function getGoogleDocsToken(userId: string) {
  return getOAuthToken(userId, "google-docs", [
    "https://www.googleapis.com/auth/documents",
  ]);
}

export async function getCRMToken(userId: string) {
  // Inbound app demo project
  return getOAuthToken(userId, "custom-crm", [
    "https://www.googleapis.com/auth/contacts.readonly",
  ]);
}

export async function getZoomToken(userId: string) {
  return getOAuthToken(userId, "zoom", ["meeting:write"]);
}
