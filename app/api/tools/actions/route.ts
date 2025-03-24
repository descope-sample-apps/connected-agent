import { NextResponse } from "next/server";
import { getServerToolActions } from "@/lib/server-storage";
import { session } from "@descope/nextjs-sdk/server";

export async function GET() {
  try {
    const userSession = await session();
    const userId = userSession?.token?.sub;

    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const actions = getServerToolActions(userId);
    return NextResponse.json({ actions });
  } catch (error) {
    console.error("Error fetching tool actions:", error);
    return NextResponse.json(
      { error: "Failed to fetch tool actions" },
      { status: 500 }
    );
  }
}
