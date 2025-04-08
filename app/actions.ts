"use server";

import { session } from "@descope/nextjs-sdk/server";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

interface GenerateTitleParams {
  message: string;
}

export async function generateTitleFromUserMessage({
  message,
}: GenerateTitleParams): Promise<string> {
  if (!message || message.trim().length === 0) {
    return "New Chat";
  }

  try {
    // Simple approach: Take the first few words and capitalize them
    const words = message.split(" ").filter(Boolean);

    // Take up to 6 words for the title
    const titleWords = words.slice(0, 6);

    // Format the title: capitalize first letter of each word
    const title = titleWords
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

    // Truncate if too long
    const finalTitle = title.length > 50 ? title.slice(0, 47) + "..." : title;

    return finalTitle || "New Chat";
  } catch (error) {
    console.error("Error generating title:", error);
    return "New Chat";
  }
}

export async function updateChatTitle({
  chatId,
  title,
}: {
  chatId: string;
  title: string;
}) {
  const userSession = await session();
  const userId = userSession?.token?.sub;

  if (!userId) {
    throw new Error("Unauthorized");
  }

  // In a real implementation, this would update the database
  /* 
  await db.update(chats)
    .set({ title, updatedAt: new Date() })
    .where(
      and(
        eq(chats.id, chatId),
        eq(chats.userId, userId)
      )
    );
  */

  console.log("Updated chat title:", { chatId, title });
  return { success: true };
}
