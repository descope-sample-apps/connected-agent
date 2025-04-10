import { NextResponse } from "next/server";
import { saveChat, getChatById, getChats } from "@/lib/db/queries";
import { cookies } from "next/headers";

// Get user ID - in a real app, you'd use authentication
function getUserId(): string {
  // For demo purposes, use a fixed ID or generate one
  const userId = "demo-user-" + Math.random().toString(36).substring(2, 7);
  return userId;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const userId = getUserId();

    if (id) {
      // Get a specific chat by ID
      const chat = await getChatById({ id });

      if (!chat) {
        return NextResponse.json({ error: "Chat not found" }, { status: 404 });
      }

      // In a real app, check if the user has permission to access this chat

      return NextResponse.json(chat);
    }

    // Get all chats for the user
    const chats = await getChats(userId);
    return NextResponse.json(chats);
  } catch (error) {
    console.error("Error fetching chat history:", error);
    return NextResponse.json(
      { error: "Failed to fetch chat history" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { id, title, message } = await request.json();
    const userId = getUserId();

    if (!id || !title) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Create a new chat
    const chat = await saveChat(userId, title, id);

    return NextResponse.json(chat);
  } catch (error) {
    console.error("Error creating chat:", error);
    return NextResponse.json(
      { error: "Failed to create chat" },
      { status: 500 }
    );
  }
}
