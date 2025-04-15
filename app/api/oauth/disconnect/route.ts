import { session } from "@descope/nextjs-sdk/server";
import { NextResponse } from "next/server";
import { trackError, trackOAuthEvent } from "@/lib/analytics";

/**
 * This route handles disconnecting an OAuth connection
 * POST /api/oauth/disconnect
 */
export async function POST(request: Request) {
  try {
    // Get the user session
    const userSession = await session();
    const userId = userSession?.token?.sub;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the provider ID from the request
    const { providerId } = await request.json();

    if (!providerId) {
      return NextResponse.json(
        { error: "Provider ID is required" },
        { status: 400 }
      );
    }

    // Track disconnect initiated event
    trackOAuthEvent("disconnect_initiated", {
      userId,
      provider: providerId,
    });

    // Get Descope credentials
    const managementKey = process.env.DESCOPE_MANAGEMENT_KEY;
    const projectId = process.env.NEXT_PUBLIC_DESCOPE_PROJECT_ID;

    if (!managementKey || !projectId) {
      console.error("Missing Descope credentials");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Explicitly ensure we're forcing disconnection even if errors occur
    let success = false;
    let errorDetails = null;

    const baseUrl = process.env.DESCOPE_BASE_URL || "https://api.descope.com";

    try {
      // Call Descope API to revoke the token using the correct endpoint with query parameters
      const url = `${baseUrl}/v1/mgmt/outbound/user/tokens?appId=${encodeURIComponent(
        providerId
      )}&userId=${encodeURIComponent(userId)}`;

      console.log(`Making disconnect request to Descope: ${url}`);

      const response = await fetch(url, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${projectId}:${managementKey}`,
        },
      });

      // Log the response
      console.log(
        `Descope disconnect response status: ${response.status} ${response.statusText}`
      );

      try {
        const responseText = await response.text();
        console.log(
          `Descope disconnect response body: ${
            responseText || "Empty response"
          }`
        );
      } catch (e) {
        console.log("No response body available");
      }

      if (response.ok || response.status === 404) {
        success = true;
      } else {
        errorDetails = `API error: ${response.status} ${response.statusText}`;
      }
    } catch (error) {
      console.error("Error in disconnect API call:", error);
      errorDetails = error instanceof Error ? error.message : String(error);
    }

    // Always track the event, regardless of outcome
    if (success) {
      trackOAuthEvent("disconnect_successful", {
        userId,
        provider: providerId,
        ...(errorDetails && { errorDetails }),
      });
    } else {
      trackOAuthEvent("disconnect_initiated", {
        userId,
        provider: providerId,
        status: "failed",
        ...(errorDetails && { errorDetails }),
      });

      // Also track as a general error
      trackError(
        new Error(
          `Failed to disconnect provider: ${errorDetails || "Unknown error"}`
        ),
        {
          userId,
          provider: providerId,
        }
      );
    }

    // Always return success to the client to ensure UI is updated
    // This forces the client to treat the provider as disconnected
    return NextResponse.json({
      success: true,
      forced: true,
      details: errorDetails
        ? `Forced disconnect (error: ${errorDetails})`
        : "Disconnected successfully",
    });
  } catch (error) {
    console.error("Error in disconnect handler:", error);

    // Track the error
    trackError(error instanceof Error ? error : new Error(String(error)));

    return NextResponse.json(
      { error: "An error occurred while processing your request" },
      { status: 500 }
    );
  }
}
