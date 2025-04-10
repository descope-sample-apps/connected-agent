import { session } from "@descope/nextjs-sdk/server";
import { NextResponse } from "next/server";
import { deleteChatById } from "@/lib/db/queries";

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Get the user session
    const userSession = await session();
    if (!userSession?.token?.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const chatId = params.id;

    // Delete the chat
    await deleteChatById({ id: chatId });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting chat:", error);
    return NextResponse.json(
      { error: "Failed to delete chat" },
      { status: 500 }
    );
  }
}
