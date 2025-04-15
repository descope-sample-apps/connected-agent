import { NextResponse } from "next/server";

/**
 * This route handles OAuth callback from Descope
 * Instead of trying to close the window directly, which won't work for security reasons,
 * we redirect to a client-side page that can properly close the popup
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const state = url.searchParams.get("state");

    console.log(
      "OAuth callback received - redirecting to client-side redirect page"
    );

    // Build redirect URL to our client-side OAuth redirect page
    const redirectUrl = new URL("/oauth-redirect", url.origin);

    // Pass along the state parameter if it exists
    if (state) {
      redirectUrl.searchParams.set("state", state);
    }

    // Add success flag
    redirectUrl.searchParams.set("status", "success");

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error("Error in OAuth callback handler:", error);

    // On error, redirect to oauth-redirect with error param
    const redirectUrl = new URL("/oauth-redirect", new URL(request.url).origin);
    redirectUrl.searchParams.set("status", "error");
    redirectUrl.searchParams.set(
      "error",
      error instanceof Error ? error.message : String(error)
    );

    return NextResponse.redirect(redirectUrl);
  }
}
