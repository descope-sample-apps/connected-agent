"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { trackOAuthEvent } from "@/lib/analytics";

// Create a separate component that uses useSearchParams
function OAuthRedirectContent() {
  const searchParams = useSearchParams();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleRedirect = async () => {
      try {
        // Get parameters from URL
        const error = searchParams.get("error");
        const errorDescription = searchParams.get("error_description");

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

          // Send error message to parent window
          if (typeof window !== "undefined" && window.opener) {
            window.opener.postMessage(
              { type: "oauth-error", error: errorDescription || error },
              window.location.origin
            );
          }
        } else {
          // No error means success - Descope has handled the code exchange
          console.log("OAuth successful");

          // Track success
          trackOAuthEvent("connection_successful", {
            provider: "oauth",
          });

          // Send success message to parent window
          if (typeof window !== "undefined" && window.opener) {
            window.opener.postMessage(
              { type: "oauth-success" },
              window.location.origin
            );
          }
        }

        // Close the popup window immediately
        if (typeof window !== "undefined") {
          window.close();
        }
      } catch (error) {
        console.error("Error in OAuth redirect handler:", error);
        trackOAuthEvent("connection_failed", {
          provider: "oauth",
          error: String(error),
        });

        // Send error message to parent window
        if (typeof window !== "undefined" && window.opener) {
          window.opener.postMessage(
            { type: "oauth-error", error: String(error) },
            window.location.origin
          );
        }

        // Close the popup window
        if (typeof window !== "undefined") {
          window.close();
        }
      }
    };

    handleRedirect();
  }, [searchParams]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
      <div className="w-full max-w-md space-y-4">
        <h1 className="text-2xl font-bold">Completing Authorization</h1>
        {errorMessage ? (
          <div className="text-red-500">{errorMessage}</div>
        ) : (
          <div className="text-gray-600">
            Please wait while we complete the authorization process...
          </div>
        )}
      </div>
    </div>
  );
}

// Wrap the component that uses useSearchParams in Suspense
export default function OAuthRedirectPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Loading...</h1>
            <p className="text-gray-600">Please wait...</p>
          </div>
        </div>
      }
    >
      <OAuthRedirectContent />
    </Suspense>
  );
}
