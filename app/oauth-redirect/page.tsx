"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { trackOAuthEvent } from "@/lib/analytics";

// Create a separate component that uses useSearchParams
function OAuthRedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleRedirect = async () => {
      try {
        // Get parameters from URL
        const code = searchParams.get("code"); // Authorization code
        const error = searchParams.get("error");
        const errorDescription = searchParams.get("error_description");
        const state = searchParams.get("state");

        // Parse state to get redirect information
        let redirectPath = "/";
        let redirectTo = "profile";
        let chatId = null;

        // Try to parse state JSON
        if (state) {
          try {
            const stateObj = JSON.parse(state);
            redirectTo = stateObj.redirectTo || "profile";

            // If state includes a chatId, use it for returning to the specific chat
            if (stateObj.chatId) {
              chatId = stateObj.chatId;
              console.log("Found chat ID in state:", chatId);
            }
          } catch (e) {
            console.error("Failed to parse state JSON:", e);
          }
        }

        // Check if there's an error
        if (error) {
          console.error("OAuth error:", error, errorDescription);
          setErrorMessage(errorDescription || error);

          // Track error
          trackOAuthEvent("connection_failed", {
            provider: "oauth",
            error,
            errorDescription: errorDescription || "",
          });

          // Redirect with error parameters
          if (redirectTo === "chat" && chatId) {
            // If returning to chat, include the chat ID
            redirectPath = `/?oauth=error&error=${encodeURIComponent(
              error
            )}&redirectTo=chat&chatId=${chatId}`;
          } else {
            // Otherwise, redirect to generic error page
            redirectPath = `/?oauth=error&error=${encodeURIComponent(
              error
            )}&redirectTo=${redirectTo}`;
          }

          // Redirect after a short delay
          setTimeout(() => {
            router.push(redirectPath);
          }, 1000);
          return;
        }

        // No error, handle successful authorization
        if (code) {
          console.log("OAuth successful, code received");

          // Track success
          trackOAuthEvent("connection_successful", {
            provider: "oauth",
            redirectTo,
            hasCode: !!code,
          });

          // Build redirect URL depending on where we need to go
          if (redirectTo === "chat" && chatId) {
            // If returning to chat, include the chat ID
            redirectPath = `/?oauth=success&redirectTo=chat&chatId=${chatId}`;
          } else {
            // Otherwise, redirect to profile or home
            redirectPath = `/?oauth=success&redirectTo=${redirectTo}`;
          }

          // Redirect immediately
          router.push(redirectPath);
          return;
        }

        // No code and no error, redirect to home
        console.log("No code or error found in OAuth redirect");
        router.push("/");
      } catch (error) {
        console.error("Error in OAuth redirect:", error);
        setErrorMessage("An unexpected error occurred during authentication.");

        // Redirect to home with error after a delay
        setTimeout(() => {
          router.push("/?oauth=error&error=unexpected_error");
        }, 2000);
      }
    };

    handleRedirect();
  }, [searchParams, router]);

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mb-4"></div>
      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
        {errorMessage ? "Authentication Error" : "Redirecting..."}
      </h2>
      <p className="text-gray-600 dark:text-gray-400">
        {errorMessage || "Completing your authentication. Please wait..."}
      </p>
    </div>
  );
}

export default function OAuthRedirectPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
            Loading...
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Preparing authentication...
          </p>
        </div>
      }
    >
      <OAuthRedirectContent />
    </Suspense>
  );
}
