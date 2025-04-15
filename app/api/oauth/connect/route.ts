import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { trackOAuthEvent, trackError } from "@/lib/analytics";
import { getRequiredScopes } from "@/lib/openapi-utils";

export const runtime = "nodejs";

/**
 * This route is used to initiate an OAuth connection flow
 */
export async function POST(request: Request) {
  try {
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
    const refreshTokenHeader = request.headers.get("X-Refresh-Token");
    const cookieStore = await cookies();
    const refreshTokenCookie = cookieStore.get("DSR");
    const refreshToken = refreshTokenCookie?.value || refreshTokenHeader;

    if (!refreshToken) {
      console.error("OAuth Connect Error: No refresh token found");
      return NextResponse.json(
        { message: "Authentication required" },
        { status: 401 }
      );
    }

    // Check if scopes are provided in the request
    let scopes = options.scopes || [];

    // If no scopes are provided, try to get them from the OpenAPI spec
    if (!scopes || scopes.length === 0) {
      try {
        // Extract the provider from the appId (e.g., "google-calendar" -> "google-calendar")
        const provider = appId;
        console.log(
          `No scopes provided, fetching from OpenAPI spec for ${provider}`
        );

        // Get scopes from OpenAPI spec
        const openApiScopes = await getRequiredScopes(provider, "connect");
        if (openApiScopes && openApiScopes.length > 0) {
          console.log(
            `Using scopes from OpenAPI spec: ${openApiScopes.join(", ")}`
          );
          scopes = openApiScopes;
        }
      } catch (error) {
        console.error("Error getting scopes from OpenAPI spec:", error);
        // Continue without scopes if there's an error
      }
    }

    const baseUrl = process.env.DESCOPE_BASE_URL || "https://api.descope.com";
    const projectId = process.env.NEXT_PUBLIC_DESCOPE_PROJECT_ID || "";

    // Prepare the request body with the provider field
    const requestBody = {
      appId,
      provider: appId, // Add the provider field required by Descope
      options: {
        ...options,
        ...(scopes.length > 0 && { scopes }),
      },
    };

    console.log(
      "Sending request to Descope:",
      JSON.stringify(requestBody, null, 2)
    );

    const response = await fetch(`${baseUrl}/v1/outbound/oauth/connect`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${projectId}:${refreshToken}`,
      },
      body: JSON.stringify(requestBody),
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
