import { NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * This route handles the OAuth callback after authorization
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const error = url.searchParams.get("error");
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const chatId = url.searchParams.get("chatId");

    // Parse the state parameter to get the redirectTo value
    let redirectTo = "chat";
    let originalUrl = "";
    try {
      if (state) {
        const stateObj = JSON.parse(state);
        if (
          stateObj.redirectTo &&
          (stateObj.redirectTo === "profile" || stateObj.redirectTo === "chat")
        ) {
          redirectTo = stateObj.redirectTo;
        }

        // Get the original URL if available (for returning to specific chats)
        if (stateObj.originalUrl) {
          originalUrl = stateObj.originalUrl;
        }
      }
    } catch (e) {
      console.error("Error parsing state parameter:", e);
    }

    // Base app URL
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || "";

    // Determine if the connection was initiated from the chat interface
    const isFromChat = redirectTo === "chat" && chatId;

    // Determine the redirect URL to return to
    let redirectURL = `${baseUrl}?oauth=${
      error ? "error" : "success"
    }&redirectTo=${redirectTo}`;

    // Add chat ID if available
    if (chatId) {
      redirectURL += `&chatId=${chatId}`;
    }

    // Add the original URL if available (full path where connection was initiated)
    if (originalUrl) {
      redirectURL += `&originalUrl=${encodeURIComponent(originalUrl)}`;
    }

    if (error) {
      console.error("OAuth error:", error);

      // For popup flow, show an HTML page that will notify the parent and close itself
      return new Response(
        `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Authentication Error</title>
          <script>
            // Notify parent window and close
            window.onload = function() {
              // Small delay to ensure the page loads
              setTimeout(function() {
                window.location.href = "${redirectURL}&error=${encodeURIComponent(
          error
        )}";
                // Only close if in a popup
                if (window.opener) {
                  window.close();
                }
              }, 300);
            }
          </script>
        </head>
        <body>
          <h2>Authentication Error</h2>
          <p>Error: ${error}</p>
          <p>Redirecting${window.opener ? " and closing window" : ""}...</p>
        </body>
        </html>
        `,
        {
          headers: {
            "Content-Type": "text/html",
          },
        }
      );
    }

    if (!code) {
      console.error("No authorization code received");
      return new Response(
        `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Authentication Error</title>
          <script>
            // Notify parent window and close
            window.onload = function() {
              // Small delay to ensure the page loads
              setTimeout(function() {
                window.location.href = "${redirectURL}&error=no_code";
                // Only close if in a popup
                if (window.opener) {
                  window.close();
                }
              }, 300);
            }
          </script>
        </head>
        <body>
          <h2>Authentication Error</h2>
          <p>No authorization code received</p>
          <p>Redirecting${window.opener ? " and closing window" : ""}...</p>
        </body>
        </html>
        `,
        {
          headers: {
            "Content-Type": "text/html",
          },
        }
      );
    }

    // Get the DSR from cookies
    const cookieStore = await cookies();
    const refreshJwt = cookieStore.get("DSR")?.value;

    // Prepare headers with DSR if available
    const requestHeaders: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (refreshJwt) {
      requestHeaders[
        "Authorization"
      ] = `Bearer ${process.env.NEXT_PUBLIC_DESCOPE_PROJECT_ID}:${refreshJwt}`;
    }

    // Exchange the code for a token
    const response = await fetch(
      "https://api.descope.com/v1/outbound/oauth/callback",
      {
        method: "POST",
        headers: requestHeaders,
        body: JSON.stringify({
          code,
          state,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      const errorMessage =
        errorData.message || "Failed to exchange code for token";

      return new Response(
        `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Authentication Error</title>
          <script>
            // Notify parent window and close
            window.onload = function() {
              // Small delay to ensure the page loads
              setTimeout(function() {
                window.location.href = "${redirectURL}&error=${encodeURIComponent(
          errorMessage
        )}";
                // Only close if in a popup
                if (window.opener) {
                  window.close();
                }
              }, 300);
            }
          </script>
        </head>
        <body>
          <h2>Authentication Error</h2>
          <p>Error: ${errorMessage}</p>
          <p>Redirecting${window.opener ? " and closing window" : ""}...</p>
        </body>
        </html>
        `,
        {
          headers: {
            "Content-Type": "text/html",
          },
        }
      );
    }

    // Success! Return a page that will redirect with success parameter
    // Add JavaScript to reload connections if coming from profile page
    return new Response(
      `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Authentication Successful</title>
        <script>
          // Notify parent window and close
          window.onload = function() {
            // Small delay to ensure the page loads
            setTimeout(function() {
              // Set success flag for parent window
              if (window.opener) {
                window.opener.postMessage({ type: 'oauth-success', redirectTo: '${redirectTo}', originalUrl: '${originalUrl}', chatId: '${
        chatId || ""
      }' }, '*');
              }
              
              // Redirect to the appropriate page
              window.location.href = "${redirectURL}";
              
              // Only close if in a popup
              if (window.opener) {
                window.close();
              }
            }, 300);
          }
        </script>
      </head>
      <body>
        <h2>Authentication Successful</h2>
        <p>You have successfully connected your account.</p>
        <p>Redirecting${window.opener ? " and closing window" : ""}...</p>
      </body>
      </html>
      `,
      {
        headers: {
          "Content-Type": "text/html",
        },
      }
    );
  } catch (error) {
    console.error("Error in OAuth callback:", error);
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || "";

    return new Response(
      `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Authentication Error</title>
        <script>
          // Notify parent window and close
          window.onload = function() {
            // Small delay to ensure the page loads
            setTimeout(function() {
              window.location.href = "${baseUrl}?oauth=error&error=${encodeURIComponent(
        String(error)
      )}";
              // Only close if in a popup
              if (window.opener) {
                window.close();
              }
            }, 300);
          }
        </script>
      </head>
      <body>
        <h2>Authentication Error</h2>
        <p>An unexpected error occurred: ${String(error)}</p>
        <p>Redirecting${window.opener ? " and closing window" : ""}...</p>
      </body>
      </html>
      `,
      {
        headers: {
          "Content-Type": "text/html",
        },
      }
    );
  }
}
