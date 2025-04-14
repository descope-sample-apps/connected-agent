import { session } from "@descope/nextjs-sdk/server";
import { getRecentChatsWithLastMessage } from "@/lib/db/queries";

export async function GET() {
  try {
    const userSession = await session();

    if (!userSession?.token?.sub) {
      return Response.json(
        { error: "Unauthorized" },
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    const userId = userSession.token.sub;
    const recentChats = await getRecentChatsWithLastMessage({ userId });

    // Transform the data to match the expected format in the sidebar
    const chats = recentChats.map(({ chat, lastMessage }) => ({
      id: chat.id,
      title: chat.title,
      preview: lastMessage?.parts?.[0]?.text || "",
      date: chat.createdAt.toISOString(),
      updatedAt: chat.updatedAt.toISOString(),
      createdAt: chat.createdAt.toISOString(),
    }));

    return Response.json(
      { chats },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error fetching chat history:", error);
    return Response.json(
      {
        error: "An error occurred while fetching chat history",
        details: error instanceof Error ? error.message : String(error),
      },
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}
