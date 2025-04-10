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

    // Call Descope API to revoke the token using the correct endpoint with query parameters
    const url = `https://api.descope.com/v1/mgmt/outbound/user/tokens?appId=${encodeURIComponent(
      providerId
    )}&userId=${encodeURIComponent(userId)}`;

    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${projectId}:${managementKey}`,
      },
      // No body needed - using query parameters instead
    });

    // Log the response
    console.log(`Descope disconnect response: ${response.status}`);

    if (!response.ok) {
      // Even if the token doesn't exist, we consider it a success
      if (response.status === 404) {
        // Track success even if token was not found
        trackOAuthEvent("disconnect_successful", {
          userId,
          provider: providerId,
          status: "not_found",
        });

        return NextResponse.json({ success: true, status: "not_found" });
      }

      const errorData = await response.text();
      console.error("Error disconnecting from provider:", errorData);

      // Track the error
      trackError(new Error(`Failed to disconnect provider: ${errorData}`), {
        userId,
        provider: providerId,
      });

      return NextResponse.json(
        { error: "Failed to disconnect provider" },
        { status: 500 }
      );
    }

    // Track successful disconnect
    trackOAuthEvent("disconnect_successful", {
      userId,
      provider: providerId,
    });

    // Log success
    console.log(`Successfully disconnected ${providerId} for user ${userId}`);

    return NextResponse.json({ success: true });
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
