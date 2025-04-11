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
        if (stateObj.redirectTo) {
          redirectTo = stateObj.redirectTo;
        }
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

    // Determine the redirect URL to return to
    let redirectURL = `${baseUrl}?oauth=${
      error ? "error" : "success"
    }&redirectTo=${redirectTo}`;

    // Add chat ID if available
    if (chatId) {
      redirectURL += `&chatId=${chatId}`;
    }

    // Add the original URL if available
    if (originalUrl) {
      redirectURL += `&originalUrl=${encodeURIComponent(originalUrl)}`;
    }

    if (error) {
      console.error("OAuth error:", error);
      return new Response(
        `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Authentication Error</title>
          <script>
            window.onload = function() {
              if (window.opener) {
                // Send error message to parent window
                window.opener.postMessage({ 
                  type: 'oauth-error', 
                  error: '${encodeURIComponent(error)}' 
                }, '*');
                
                // Close this popup window
                setTimeout(function() {
                  window.close();
                }, 100);
              } else {
                // If no opener (direct navigation), redirect to error page
                window.location.href = "${redirectURL}&error=${encodeURIComponent(
          error
        )}";
              }
            }
          </script>
        </head>
        <body>
          <h2>Authentication Error</h2>
          <p>Error: ${error}</p>
          <p>This window should close automatically...</p>
        </body>
        </html>
        `,
        {
          headers: { "Content-Type": "text/html" },
        }
      );
    }

    // Success case
    return new Response(
      `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Authentication Successful</title>
        <script>
          window.onload = function() {
            if (window.opener) {
              // Send success message to parent window
              window.opener.postMessage({ 
                type: 'oauth-success',
                redirectTo: '${redirectTo}',
                originalUrl: '${originalUrl}',
                chatId: '${chatId || ""}'
              }, '*');
              
              // Close this popup window
              setTimeout(function() {
                window.close();
              }, 100);
            } else {
              // If no opener (direct navigation), redirect to success page
              window.location.href = "${redirectURL}";
            }
          }
        </script>
      </head>
      <body>
        <h2>Authentication Successful</h2>
        <p>This window should close automatically...</p>
      </body>
      </html>
      `,
      {
        headers: { "Content-Type": "text/html" },
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
          window.onload = function() {
            if (window.opener) {
              // Send error message to parent window
              window.opener.postMessage({ 
                type: 'oauth-error', 
                error: '${encodeURIComponent(String(error))}' 
              }, '*');
              
              // Close this popup window
              setTimeout(function() {
                window.close();
              }, 100);
            } else {
              // If no opener (direct navigation), redirect to error page
              window.location.href = "${baseUrl}?oauth=error&error=${encodeURIComponent(
        String(error)
      )}";
            }
          }
        </script>
      </head>
      <body>
        <h2>Authentication Error</h2>
        <p>Error: ${error}</p>
        <p>This window should close automatically...</p>
      </body>
      </html>
      `,
      {
        headers: { "Content-Type": "text/html" },
      }
    );
  }
}
