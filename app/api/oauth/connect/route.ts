import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { trackOAuthEvent, trackError } from "@/lib/analytics";

export const runtime = "nodejs";

// Add default scopes for providers when none are specified
const DEFAULT_SCOPES: Record<string, string[]> = {
  "google-calendar": ["https://www.googleapis.com/auth/calendar.readonly"],
  "google-docs": ["https://www.googleapis.com/auth/documents.readonly"],
  zoom: ["meeting:read"],
  crm: ["contacts.read"],
  servicenow: ["read"],
};

/**
 * This route is used to initiate an OAuth connection flow
 */
export async function POST(request: Request) {
  try {
    // Parse the request body
    const { appId, options } = await request.json();
    console.log("Received OAuth connect request:", { appId, options });

    if (!options?.redirectUrl) {
      return NextResponse.json(
        { error: "Redirect URL is required" },
        { status: 400 }
      );
    }

    // Get the DSR from cookies
    const cookieStore = await cookies();
    const refreshJwt = cookieStore.get("DSR")?.value;

    // Get refresh token from request headers if not in cookies
    const headers = request.headers;
    const headerRefreshToken = headers.get("x-refresh-token");

    // Prepare headers with DSR if available
    const requestHeaders: HeadersInit = {
      "Content-Type": "application/json",
    };

    // Use refresh token from header if available, otherwise use cookie
    const refreshToken = headerRefreshToken || refreshJwt;
    if (refreshToken) {
      requestHeaders[
        "Authorization"
      ] = `Bearer ${process.env.NEXT_PUBLIC_DESCOPE_PROJECT_ID}:${refreshToken}`;
    }

    // Ensure we have a base URL
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL;
    if (!baseUrl) {
      console.error("NEXT_PUBLIC_APP_URL environment variable is not set");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Check if we need to add default scopes
    let scopes = options.scopes;
    if (!scopes || !Array.isArray(scopes) || scopes.length === 0) {
      scopes = DEFAULT_SCOPES[appId] || [];
      console.log(
        `No scopes provided, using default scopes for ${appId}:`,
        scopes
      );
    }

    const requestBody = {
      appId,
      options: {
        redirectUrl: `${baseUrl}/api/oauth/callback`,
        scopes,
      },
    };

    console.log("Sending request to Descope:", {
      url: "https://api.descope.com/v1/outbound/oauth/connect",
      method: "POST",
      headers: requestHeaders,
      body: requestBody,
    });

    // Call Descope's outbound app endpoint
    const response = await fetch(
      "https://api.descope.com/v1/outbound/oauth/connect",
      {
        method: "POST",
        headers: requestHeaders,
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error("Descope API error:", error);
      return NextResponse.json(
        { error: error.message || "Failed to initiate OAuth connection" },
        { status: response.status }
      );
    }

    const { url } = await response.json();
    console.log("Received authorization URL from Descope: ");
    return NextResponse.json({ url });
  } catch (error) {
    console.error("Error connecting to OAuth provider:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to initiate OAuth connection",
      },
      { status: 500 }
    );
  }
}
