import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { trackOAuthEvent, trackError } from "@/lib/analytics";

export const runtime = "nodejs";

/**
 * This route is used to initiate an OAuth connection flow
 */
export async function POST(request: Request) {
  try {
    // Log the request start
    console.log("===== OAUTH CONNECT REQUEST =====");

    // Parse the request
    const { appId, options } = await request.json();

    console.log(`OAuth Connect Request for app: ${appId}`);
    console.log(`Options:`, JSON.stringify(options, null, 2));

    // Validate required parameters
    if (!appId) {
      console.error("OAuth Connect Error: Missing appId");
      return NextResponse.json(
        { message: "Missing required parameter: appId" },
        { status: 400 }
      );
    }

    if (!options || !options.redirectUrl) {
      console.error("OAuth Connect Error: Missing redirectUrl in options");
      return NextResponse.json(
        { message: "Missing required parameter: options.redirectUrl" },
        { status: 400 }
      );
    }

    // Get the user's refresh token from cookie or header
    const cookieStore = cookies();
    const refreshTokenCookie = cookieStore.get("DSR");
    const refreshTokenHeader = request.headers.get("X-Refresh-Token");
    const refreshToken = refreshTokenCookie?.value || refreshTokenHeader;

    if (!refreshToken) {
      console.error("OAuth Connect Error: No refresh token found");
      return NextResponse.json(
        { message: "Authentication required" },
        { status: 401 }
      );
    }

    console.log(`Refresh token found (${refreshToken.substring(0, 10)}...)`);

    // Define default scopes for Google Docs if needed
    if (
      appId === "google-docs" &&
      (!options.scopes || options.scopes.length === 0)
    ) {
      console.log("Adding default scopes for Google Docs");
      options.scopes = [
        "https://www.googleapis.com/auth/documents",
        "https://www.googleapis.com/auth/drive",
        "https://www.googleapis.com/auth/drive.file",
      ];
      console.log("Updated scopes:", options.scopes);
    }

    const serviceUrl =
      process.env.DESCOPE_SERVICE_URL || "https://api.descope.com";
    const projectId = process.env.NEXT_PUBLIC_DESCOPE_PROJECT_ID || "";

    // Make the request to Descope API
    console.log(
      `Making request to Descope API: ${serviceUrl}/v1/auth/oauth/authorize`
    );
    console.log(`Request body:`, {
      appId,
      options,
      refreshToken: "PRESENT (hidden)",
    });

    const response = await fetch(`${serviceUrl}/v1/auth/oauth/authorize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-descope-sdk-web-refresh-token": refreshToken,
        Authorization: `Bearer ${projectId}`,
      },
      body: JSON.stringify({
        appId,
        options,
      }),
    });

    console.log(
      `Descope API Response Status: ${response.status} ${response.statusText}`
    );

    // If response is not ok, log the error and return a 400
    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Descope API Error:`, {
        status: response.status,
        statusText: response.statusText,
        body: errorBody,
      });

      let errorMessage;
      try {
        const parsedError = JSON.parse(errorBody);
        errorMessage = parsedError.message || response.statusText;
      } catch (e) {
        errorMessage = errorBody || response.statusText;
      }

      return NextResponse.json(
        { message: `Failed to get authorization URL: ${errorMessage}` },
        { status: response.status }
      );
    }

    // Parse the response and return the URL
    const data = await response.json();
    console.log("Successfully retrieved authorization URL");

    return NextResponse.json({ url: data.url });
  } catch (error) {
    console.error("Error in OAuth connect endpoint:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
