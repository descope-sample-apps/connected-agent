import { nanoid } from "nanoid";
import { session } from "@descope/nextjs-sdk/server";
import { getChatById } from "@/lib/db/queries";

// In a real implementation, this would be stored in a database
const sharedChats: Record<
  string,
  { chatId: string; userId: string; expiresAt?: Date }
> = {};

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  const userSession = await session();
  const userId = userSession?.token?.sub;

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Verify chat ownership
    const chat = await getChatById({ id });

    if (!chat) {
      return Response.json({ error: "Chat not found" }, { status: 404 });
    }

    if (chat.userId !== userId) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Get sharing options from request
    const { expiresInDays } = await request.json();

    // Generate share ID
    const shareId = nanoid(10); // Short, URL-friendly ID

    // Calculate expiration date if provided
    let expiresAt = undefined;
    if (expiresInDays && !isNaN(expiresInDays)) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    }

    // Store sharing information (in a real app, this would be in a database)
    sharedChats[shareId] = {
      chatId: id,
      userId,
      expiresAt,
    };

    // Generate share URL
    const shareUrl = `${
      process.env.NEXT_PUBLIC_BASE_URL || ""
    }/shared/${shareId}`;

    return Response.json({
      success: true,
      shareId,
      shareUrl,
      expiresAt,
    });
  } catch (error) {
    console.error("Error sharing chat:", error);
    return Response.json(
      {
        success: false,
        error: "Failed to share chat",
      },
      { status: 500 }
    );
  }
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const shareId = params.id;

  if (!shareId) {
    return Response.json({ error: "Share ID is required" }, { status: 400 });
  }

  const sharedChat = sharedChats[shareId];

  if (!sharedChat) {
    return Response.json({ error: "Shared chat not found" }, { status: 404 });
  }

  // Check if expired
  if (sharedChat.expiresAt && new Date() > sharedChat.expiresAt) {
    delete sharedChats[shareId]; // Clean up expired share
    return Response.json({ error: "Shared chat has expired" }, { status: 410 });
  }

  try {
    // Get the chat data
    const chat = await getChatById({ id: sharedChat.chatId });

    if (!chat) {
      return Response.json({ error: "Shared chat not found" }, { status: 404 });
    }

    return Response.json({
      success: true,
      chat,
      shareId,
      owner: sharedChat.userId,
      expiresAt: sharedChat.expiresAt,
    });
  } catch (error) {
    console.error("Error fetching shared chat:", error);
    return Response.json(
      {
        success: false,
        error: "Failed to fetch shared chat",
      },
      { status: 500 }
    );
  }
}
