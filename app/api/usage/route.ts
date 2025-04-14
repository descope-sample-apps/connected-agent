import { session } from "@descope/nextjs-sdk/server";
import { getUserUsage } from "@/lib/db/queries";

export const runtime = "nodejs";

export async function GET() {
  const userSession = await session();
  const userId = userSession?.token?.sub;

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const usage = await getUserUsage(userId);
    return Response.json({ usage });
  } catch (error) {
    console.error("Error getting usage:", error);
    return Response.json(
      { error: "Failed to get usage information" },
      { status: 500 }
    );
  }
}
