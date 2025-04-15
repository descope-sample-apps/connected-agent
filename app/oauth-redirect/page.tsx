"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { trackOAuthEvent } from "@/lib/analytics";

// Create a separate component that uses useSearchParams
function OAuthRedirectContent() {
  const searchParams = useSearchParams();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);

  // Function to close the window with multiple methods
  const closeWindow = () => {
    console.log("Attempting to close popup window");
    setClosing(true);

    // Try multiple closing methods
    try {
      window.close();
    } catch (e) {
      console.error("window.close failed:", e);
    }
    try {
      window.self.close();
    } catch (e) {
      console.error("window.self.close failed:", e);
    }
    try {
      self.close();
    } catch (e) {
      console.error("self.close failed:", e);
    }

    // If we're still here, window didn't close, show manual close button
    setTimeout(() => {
      if (document.getElementById("manualCloseButton")) {
        document.getElementById("manualCloseButton")!.style.display = "block";
      }
    }, 200);
  };

  useEffect(() => {
    const handleRedirect = async () => {
      try {
        console.log("OAuth redirect page loaded");

        // Get status and state from URL
        const status = searchParams.get("status") || "success";
        const state = searchParams.get("state");
        const error = searchParams.get("error");

        if (error) {
          setErrorMessage(error);
          console.error("OAuth error:", error);

          // Track error
          trackOAuthEvent("connection_failed", {
            provider: "oauth",
            error,
          });

          // Send error message to parent window
          if (typeof window !== "undefined" && window.opener) {
            try {
              window.opener.postMessage(
                { type: "oauth-error", error, state },
                window.location.origin
              );
              console.log("Error message posted to parent window");
            } catch (e) {
              console.error("Failed to post error message to parent:", e);
            }
          }
        } else {
          // Handle success
          console.log("OAuth connection successful");

          // Track success
          trackOAuthEvent("connection_successful", {
            provider: "oauth",
          });

          // Send success message to parent window
          if (typeof window !== "undefined" && window.opener) {
            try {
              window.opener.postMessage(
                { type: "oauth-success", state },
                window.location.origin
              );
              console.log("Success message posted to parent window");
            } catch (e) {
              console.error("Failed to post success message to parent:", e);
            }
          }
        }
      } catch (err) {
        console.error("Error in OAuth redirect handler:", err);
        setErrorMessage(err instanceof Error ? err.message : String(err));
      } finally {
        // Attempt to close the window after a short delay to ensure messages are delivered
        setTimeout(closeWindow, 800);

        // If still open, try again after a longer delay
        setTimeout(closeWindow, 1500);
      }
    };

    // Run the handleRedirect function immediately
    handleRedirect();

    // Set up window onload event to try closing again
    window.onload = closeWindow;
  }, [searchParams]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
      <div className="w-full max-w-md space-y-4">
        <h1 className="text-2xl font-bold">
          {errorMessage ? "Authorization Error" : "Authorization Complete"}
        </h1>
        {errorMessage ? (
          <div className="text-red-500 bg-red-50 p-4 rounded-md border border-red-200">
            <p className="font-medium">Connection failed</p>
            <p className="text-sm mt-1">{errorMessage}</p>
          </div>
        ) : (
          <div className="text-green-700 bg-green-50 p-4 rounded-md border border-green-200">
            <p className="font-medium">Connection successful!</p>
            <p className="text-sm mt-1">
              You can now return to the application.
            </p>
          </div>
        )}
        <p className="text-sm text-gray-500">
          {closing
            ? "Closing window..."
            : "This window will close automatically..."}
        </p>
        <button
          id="manualCloseButton"
          onClick={closeWindow}
          className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors w-full"
          style={{ display: "none" }}
        >
          Close Window
        </button>
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
