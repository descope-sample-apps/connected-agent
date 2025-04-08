import { session } from "@descope/nextjs-sdk/server";
import { getRecentChatsWithLastMessage } from "@/lib/db/queries";

export async function GET() {
  try {
    const userSession = await session();

    if (!userSession?.token?.sub) {
      return new Response("Unauthorized", { status: 401 });
    }

    const userId = userSession.token.sub;
    const recentChats = await getRecentChatsWithLastMessage({ userId });

    return Response.json({ chats: recentChats });
  } catch (error) {
    console.error("Error fetching chats:", error);
    return new Response("An error occurred while fetching chats", {
      status: 500,
    });
  }
}
