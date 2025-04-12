import { NextResponse } from "next/server";
import { redirect } from "next/navigation";

/**
 * This route handles OAuth callback from Descope
 * It extracts code and state and redirects to the oauth-redirect page
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);

    // Get the authorization code and state
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");
    const errorDescription = url.searchParams.get("error_description");
    const state = url.searchParams.get("state");

    // Build redirect URL to our OAuth redirect page
    const redirectUrl = new URL("/oauth-redirect", url.origin);

    // Pass along all relevant parameters
    if (code) {
      redirectUrl.searchParams.set("code", code);
    }

    if (error) {
      redirectUrl.searchParams.set("error", error);

      if (errorDescription) {
        redirectUrl.searchParams.set("error_description", errorDescription);
      }
    }

    if (state) {
      redirectUrl.searchParams.set("state", state);
    }

    console.log("Redirecting OAuth callback to:", redirectUrl.toString());

    // Redirect to oauth-redirect page with all parameters
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error("Error in OAuth callback handler:", error);

    // Redirect to home with error
    return NextResponse.redirect(
      new URL("/?oauth=error&error=callback_error", request.url)
    );
  }
}
