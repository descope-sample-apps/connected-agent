/**
 * Connection Manager - Handles OAuth connection status in localStorage
 */

export type OAuthProvider =
  | "google-calendar"
  | "google-docs"
  | "google-meet"
  | "custom-crm"
  | "slack";

const CONNECTION_KEY_PREFIX = "oauth_connection_";

/**
 * Check if a provider is connected based on localStorage
 */
export function isConnected(provider: OAuthProvider): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(`${CONNECTION_KEY_PREFIX}${provider}`) === "true";
}

/**
 * Set connection status for a provider in localStorage
 */
export function setConnected(
  provider: OAuthProvider,
  connected: boolean
): void {
  if (typeof window === "undefined") return;

  if (connected) {
    localStorage.setItem(`${CONNECTION_KEY_PREFIX}${provider}`, "true");
    console.log(`Connection status for ${provider} set to connected`);
  } else {
    localStorage.removeItem(`${CONNECTION_KEY_PREFIX}${provider}`);
    console.log(`Connection status for ${provider} removed (disconnected)`);
  }
}

/**
 * Get all provider connection statuses
 */
export function getAllConnectionStatuses(): Record<OAuthProvider, boolean> {
  if (typeof window === "undefined") {
    return {
      "google-calendar": false,
      "google-docs": false,
      "google-meet": false,
      "custom-crm": false,
      slack: false,
    };
  }

  const providers: OAuthProvider[] = [
    "google-calendar",
    "google-docs",
    "google-meet",
    "custom-crm",
    "slack",
  ];

  return providers.reduce((statuses, provider) => {
    statuses[provider] = isConnected(provider);
    return statuses;
  }, {} as Record<OAuthProvider, boolean>);
}

/**
 * Disconnect all providers (remove all connection flags from localStorage)
 */
export function disconnectAll(): void {
  if (typeof window === "undefined") return;

  const providers: OAuthProvider[] = [
    "google-calendar",
    "google-docs",
    "google-meet",
    "custom-crm",
    "slack",
  ];

  providers.forEach((provider) => {
    localStorage.removeItem(`${CONNECTION_KEY_PREFIX}${provider}`);
  });

  console.log("All provider connections removed from localStorage");
}
