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

    return Response.json(
      { chats: recentChats },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error fetching chats:", error);
    return Response.json(
      {
        error: "An error occurred while fetching chats",
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
