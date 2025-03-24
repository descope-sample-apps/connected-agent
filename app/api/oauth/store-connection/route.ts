import { session } from "@descope/nextjs-sdk/server";
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

    const { provider, scopes, connectedAt } = await request.json();

    if (!provider || !scopes || !Array.isArray(scopes)) {
      return Response.json({ error: "Invalid request data" }, { status: 400 });
    }

    // In a real application, you would probably store this information in a database

    // Return success response
    return Response.json({
      success: true,
      message: "Connection stored successfully",
    });
  } catch (error) {
    console.error("Error storing OAuth connection:", error);
    return Response.json(
      { error: "Failed to store connection" },
      { status: 500 }
    );
  }
}
