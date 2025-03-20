import { session } from "@descope/nextjs-sdk/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    // Get the provider from the URL query params
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get("provider");

    if (!provider) {
      return Response.json(
        { error: "Missing provider parameter" },
        { status: 400 }
      );
    }

    // Get authenticated user
    const userSession = await session();
    const userId = userSession?.token?.sub;

    if (!userId) {
      return Response.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Prepare Descope API request
    const managementKey = process.env.DESCOPE_MANAGEMENT_KEY;
    const projectId = process.env.NEXT_PUBLIC_DESCOPE_PROJECT_ID;

    if (!managementKey || !projectId) {
      return Response.json(
        { error: "Missing Descope credentials" },
        { status: 500 }
      );
    }

    // Call Descope Management API to get authorization URL
    const response = await fetch(
      "https://api.descope.com/v1/mgmt/outbound/app/authorization/url",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${projectId}:${managementKey}`,
        },
        body: JSON.stringify({
          appId: provider,
          userId: userId,
          redirectUrl: `${
            process.env.NEXT_PUBLIC_APP_URL || window.location.origin
          }/api/oauth/callback`,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Descope API error:", errorData);
      return Response.json(
        {
          error: "Failed to get authorization URL",
          details: errorData,
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Return the authorization URL
    return Response.json({ url: data.url });
  } catch (error) {
    console.error("Error in OAuth connect API:", error);
    return Response.json(
      { error: "Failed to initiate OAuth connection" },
      { status: 500 }
    );
  }
}
