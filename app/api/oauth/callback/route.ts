import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const redirectTo = searchParams.get("redirectTo");
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code || !state) {
      return NextResponse.redirect(
        new URL(
          `/error?message=${encodeURIComponent("Invalid OAuth callback")}`,
          request.url
        )
      );
    }

    // Handle the OAuth callback with Descope's outbound app
    const descopeResponse = await fetch(
      `${process.env.NEXT_PUBLIC_DESCOPE_OUTBOUND_URL}/oauth/token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code,
          state,
          redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/callback?redirectTo=${redirectTo}`,
        }),
      }
    );

    if (!descopeResponse.ok) {
      const error = await descopeResponse.json();
      throw new Error(error.message || "Failed to exchange OAuth code");
    }

    const { sessionToken } = await descopeResponse.json();

    // Set the session token in cookies
    const response = NextResponse.redirect(
      new URL(redirectTo === "profile" ? "/profile" : "/", request.url)
    );

    response.cookies.set("DS", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    // Return an HTML response that will close the popup and notify the parent window
    return new Response(
      `
      <!DOCTYPE html>
      <html>
        <head>
          <title>OAuth Success</title>
        </head>
        <body>
          <script>
            // Notify the parent window that OAuth was successful
            if (window.opener) {
              window.opener.postMessage({ type: 'oauth_success' }, '*');
            }
            // Close the popup
            window.close();
          </script>
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
    console.error("Error handling OAuth callback:", error);
    return NextResponse.redirect(
      new URL(
        `/error?message=${encodeURIComponent(
          "Failed to complete OAuth connection"
        )}`,
        request.url
      )
    );
  }
}
