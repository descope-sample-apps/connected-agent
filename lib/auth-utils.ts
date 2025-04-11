/**
 * Utility functions for common authentication error handling
 */

/**
 * Checks if an error is a user cancellation error
 * This includes manually closing the OAuth popup
 */
export function isUserCancellationError(error: any): boolean {
  if (!error) return false;

  if (error instanceof Error) {
    return (
      error.name === "AuthCanceled" ||
      error.message === "Authentication window was closed" ||
      error.message.includes("window was closed")
    );
  }

  if (typeof error === "string") {
    return (
      error.includes("window was closed") ||
      error.includes("Authentication cancelled")
    );
  }

  return false;
}

/**
 * Silently handle user cancellation errors
 * Returns true if error was handled, false otherwise
 */
export function handleAuthError(error: any): boolean {
  if (isUserCancellationError(error)) {
    console.log("User cancelled authentication:", error);
    return true;
  }
  return false;
}
