import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const error = url.searchParams.get("error");
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

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

    if (error) {
      console.error("OAuth error:", error);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}?oauth=error&error=${error}&redirectTo=${redirectTo}`
      );
    }

    if (!code) {
      console.error("No authorization code received");
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}?oauth=error&error=no_code&redirectTo=${redirectTo}`
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
      return NextResponse.redirect(
        `${
          process.env.NEXT_PUBLIC_APP_URL
        }?oauth=error&error=${encodeURIComponent(
          errorData.message || "Failed to exchange code for token"
        )}&redirectTo=${redirectTo}`
      );
    }

    // Redirect back to the app with success and the redirectTo parameter
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}?oauth=success&redirectTo=${redirectTo}`
    );
  } catch (error) {
    console.error("Error in OAuth callback:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}?oauth=error&error=server_error&redirectTo=chat`
    );
  }
}
