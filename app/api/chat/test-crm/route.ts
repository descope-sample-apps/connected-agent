import { session } from "@descope/nextjs-sdk/server";
import { NextResponse } from "next/server";
import { getOAuthTokenWithScopeValidation } from "@/lib/oauth-utils";
import { fetchCRMDeals } from "@/lib/tools/crm";

// Debug endpoint for testing CRM deals functionality
export async function GET(request: Request) {
  try {
    // Get user session to authenticate
    const userSession = await session();
    if (!userSession?.token?.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = userSession.token.sub;
    const url = new URL(request.url);
    const companyName = url.searchParams.get("company") || "Acme Inc";

    console.log(`Testing CRM deals lookup for company: ${companyName}`);

    // Get token with necessary scopes
    const tokenResponse = await getOAuthTokenWithScopeValidation(
      userId,
      "custom-crm",
      {
        appId: "custom-crm",
        userId,
        scopes: ["deals:read"],
        operation: "tool_calling",
      }
    );

    if (!tokenResponse || "error" in tokenResponse) {
      const errorMsg =
        tokenResponse && "error" in tokenResponse
          ? tokenResponse.error
          : "Failed to get CRM access token";

      console.error("OAuth token error:", errorMsg);
      return NextResponse.json(
        {
          error: errorMsg,
          details: "Token retrieval failed",
        },
        { status: 401 }
      );
    }

    // Extract the actual token from the response
    const accessToken = tokenResponse.token.accessToken;
    console.log(`Got access token: ${accessToken.substring(0, 10)}...`);

    // Call the fetchCRMDeals function with company name
    const dealsResponse = await fetchCRMDeals(
      accessToken,
      undefined, // dealId
      undefined, // contactId
      undefined, // stage
      companyName // company name
    );

    return NextResponse.json({
      success: true,
      companySearched: companyName,
      dealsFound: dealsResponse.data?.length || 0,
      deals: dealsResponse.data,
    });
  } catch (error) {
    console.error("Error in test-crm endpoint:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
