import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { trackOAuthEvent, trackError } from "@/lib/analytics";

export const runtime = "nodejs";

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

    // Use the provided redirectUrl directly
    const requestBody = {
      appId,
      options: {
        redirectUrl: options.redirectUrl,
        ...(options.scopes && { scopes: options.scopes }),
        ...(options.state && { state: options.state }),
      },
    };

    console.log("Sending request to Descope:", {
      url: "https://api.descope.com/v1/outbound/oauth/connect",
      method: "POST",
      headers: requestHeaders,
      body: requestBody,
    });

    // Call Descope API to get the authorization URL
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

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in OAuth connect:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
