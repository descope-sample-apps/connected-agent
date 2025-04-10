import { NextResponse } from "next/server";
import { saveMessage, getMessages } from "@/lib/db/queries";
import { nanoid } from "nanoid";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get("id");

    if (!chatId) {
      return NextResponse.json(
        { error: "Chat ID is required" },
        { status: 400 }
      );
    }

    const messages = await getMessages(chatId);
    return NextResponse.json(messages);
  } catch (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get("id");

    if (!chatId) {
      return NextResponse.json(
        { error: "Chat ID is required" },
        { status: 400 }
      );
    }

    const { message } = await request.json();

    if (!message || !message.role || !message.content) {
      return NextResponse.json(
        { error: "Invalid message format" },
        { status: 400 }
      );
    }

    // Format message for database storage
    let parts = message.content;
    if (typeof parts === "string") {
      parts = [{ text: parts }];
    }

    // Handle UI elements
    const attachments = [];
    if (message.ui) {
      attachments.push({
        type: "ui_element",
        ui: message.ui,
      });
    }

    const savedMessage = await saveMessage(
      chatId,
      message.role,
      parts,
      attachments
    );

    return NextResponse.json(savedMessage);
  } catch (error) {
    console.error("Error saving message:", error);
    return NextResponse.json(
      { error: "Failed to save message" },
      { status: 500 }
    );
  }
}
