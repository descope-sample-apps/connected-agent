import { NextResponse } from "next/server";
import { session } from "@descope/nextjs-sdk/server";
import { getChatById, getChatMessages } from "@/lib/db/queries";

/**
 * API endpoint to get messages for a specific chat
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const chatId = url.searchParams.get("chatId");

    if (!chatId) {
      return NextResponse.json(
        { error: "Chat ID is required" },
        { status: 400 }
      );
    }

    // Get user session
    const userSession = await session();
    if (!userSession?.token?.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = userSession.token.sub;

    // Check if the chat exists and belongs to the user
    const chat = await getChatById({ id: chatId });
    if (!chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    // Ensure the user has permission to access this chat
    if (chat.userId !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Get chat messages
    const messages = await getChatMessages({ chatId });

    return NextResponse.json({ messages });
  } catch (error) {
    console.error("Error fetching chat messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch chat messages" },
      { status: 500 }
    );
  }
}
