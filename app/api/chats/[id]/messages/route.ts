import { session } from "@descope/nextjs-sdk/server";
import { NextRequest } from "next/server";
import { getChatById, getChatMessages } from "@/lib/db/queries";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  const userSession = await session();

  if (!userSession?.token?.sub) {
    return Response.json({ error: "Unauthorized!" }, { status: 401 });
  }

  try {
    // Get the chat to verify ownership
    const chat = await getChatById({ id });

    if (!chat) {
      return Response.json({ error: "Chat not found" }, { status: 404 });
    }

    if (chat.userId !== userSession.token.sub) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Get chat messages
    const messages = await getChatMessages({ chatId: id });

    return Response.json({ messages });
  } catch (error) {
    console.error("Error fetching chat messages:", error);
    return Response.json(
      { error: "Failed to fetch chat messages" },
      { status: 500 }
    );
  }
}
