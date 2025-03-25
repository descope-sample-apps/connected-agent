import { NextResponse } from "next/server";
import { session } from "@descope/nextjs-sdk/server";
import { getOAuthTokenWithScopeValidation } from "@/lib/oauth-utils";

export async function POST(req: Request) {
  try {
    const { serverUrl, userId } = await req.json();
    const userSession = await session();

    if (!userSession?.token?.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get OAuth token for the MCP server
    const tokenData = await getOAuthTokenWithScopeValidation(
      userSession.token.sub,
      "mcp",
      {
        appId: "mcp-client",
        userId: userSession.token.sub,
        scopes: ["tools:read", "tools:execute", "events:subscribe"],
        options: {
          serverUrl,
        },
      }
    );

    if ("error" in tokenData) {
      return NextResponse.json({ error: tokenData.error }, { status: 500 });
    }

    return NextResponse.json({
      accessToken: tokenData.token.accessToken,
    });
  } catch (error) {
    console.error("MCP OAuth Error:", error);
    return NextResponse.json(
      { error: "Failed to get OAuth token" },
      { status: 500 }
    );
  }
}
