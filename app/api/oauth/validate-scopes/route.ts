import { session } from "@descope/nextjs-sdk/server";
import { getOAuthTokenWithScopeValidation } from "@/lib/descope";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const userSession = await session();
    const userId = userSession?.token?.sub;

    if (!userId) {
      return Response.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { provider, operation } = await request.json();

    if (!provider || !operation) {
      return Response.json(
        { error: "Provider and operation are required" },
        { status: 400 }
      );
    }

    // Get token with scope validation
    const tokenData = await getOAuthTokenWithScopeValidation(
      userId,
      provider,
      operation
    );

    // If we got an error response, return it to the client
    if ("error" in tokenData) {
      return Response.json(tokenData, { status: 403 });
    }

    // Token is valid with required scopes
    return Response.json({ success: true });
  } catch (error) {
    console.error("Error validating scopes:", error);
    return Response.json(
      { error: "Failed to validate scopes" },
      { status: 500 }
    );
  }
}
