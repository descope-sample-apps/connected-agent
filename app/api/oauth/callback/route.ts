import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { trackOAuthEvent, trackError } from "@/lib/analytics";

export const runtime = "nodejs";

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
    try {
      if (state) {
        const stateObj = JSON.parse(state);
        if (
          stateObj.redirectTo &&
          (stateObj.redirectTo === "profile" || stateObj.redirectTo === "chat")
        ) {
          redirectTo = stateObj.redirectTo;
        }
      }
    } catch (e) {
      console.error("Error parsing state parameter:", e);
    }

    // Base app URL
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || "";

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
                window.location.href = "${baseUrl}?oauth=error&error=${encodeURIComponent(
          error
        )}&redirectTo=${redirectTo}${chatId ? `&chatId=${chatId}` : ''}`;
                window.close();
              }, 300);
            }
          </script>
        </head>
        <body>
          <h2>Authentication Error</h2>
          <p>Error: ${error}</p>
          <p>Redirecting and closing window...</p>
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
                window.location.href = "${baseUrl}?oauth=error&error=no_code&redirectTo=${redirectTo}${chatId ? `&chatId=${chatId}` : ''}`;
                window.close();
              }, 300);
            }
          </script>
        </head>
        <body>
          <h2>Authentication Error</h2>
          <p>No authorization code received</p>
          <p>Redirecting and closing window...</p>
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
                window.location.href = "${baseUrl}?oauth=error&error=${encodeURIComponent(
          errorMessage
        )}&redirectTo=${redirectTo}${chatId ? `&chatId=${chatId}` : ''}`;
                window.close();
              }, 300);
            }
          </script>
        </head>
        <body>
          <h2>Authentication Error</h2>
          <p>Error: ${errorMessage}</p>
          <p>Redirecting and closing window...</p>
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
              window.location.href = "${baseUrl}?oauth=success&redirectTo=${redirectTo}${chatId ? `&chatId=${chatId}` : ''}`;
              window.close();
            }, 300);
          }
        </script>
      </head>
      <body>
        <h2>Authentication Successful</h2>
        <p>You can close this window now.</p>
        <p>Redirecting and closing window...</p>
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
              window.location.href = "${baseUrl}?oauth=error&error=server_error&redirectTo=chat";
              window.close();
            }, 300);
          }
        </script>
      </head>
      <body>
        <h2>Authentication Error</h2>
        <p>A server error occurred during authentication.</p>
        <p>Redirecting and closing window...</p>
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
