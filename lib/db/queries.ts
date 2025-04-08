import { UIMessage } from "ai";
import { eq, desc, asc, and } from "drizzle-orm";
import { db } from "./index";
import { chats, messages, votes } from "./schema";
import { nanoid } from "nanoid";

// Types for database operations
export interface ChatMessage {
  id: string;
  chatId: string;
  role: string;
  parts: any;
  attachments?: Array<any>;
  createdAt: Date;
}

// Use the inferred types from our schema
export type Chat = typeof chats.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Vote = typeof votes.$inferSelect;

// These are placeholder implementations that can be replaced with actual database operations
// using Vercel Postgres, Firebase, Supabase, or other databases

export async function saveChat(userId: string, title: string, id?: string) {
  const chat = await db
    .insert(chats)
    .values({
      id: id || nanoid(),
      userId,
      title,
      createdAt: new Date(),
      updatedAt: new Date(),
      visibility: "private",
    })
    .returning();
  return chat[0];
}

export async function getChats(userId: string) {
  return await db
    .select()
    .from(chats)
    .where(eq(chats.userId, userId))
    .orderBy(desc(chats.updatedAt));
}

export async function getChat(chatId: string) {
  const result = await db.select().from(chats).where(eq(chats.id, chatId));
  return result[0];
}

export async function deleteChat(chatId: string) {
  await db.delete(chats).where(eq(chats.id, chatId));
}

export async function saveMessage(
  chatId: string,
  role: string,
  parts: any[],
  attachments: any[] = []
) {
  // Ensure parts is a valid array and properly formatted
  let processedParts = parts;

  // If parts is not an array, convert it to an array
  if (!Array.isArray(processedParts)) {
    processedParts = [processedParts];
  }

  // Filter out any undefined or null parts
  processedParts = processedParts.filter(
    (part: any) => part !== undefined && part !== null
  );

  // Ensure each part has the correct structure
  processedParts = processedParts.map((part: any) => {
    // If part is a string, convert it to an object with text property
    if (typeof part === "string") {
      return { text: part };
    }
    // If part is an object but doesn't have text property, add it
    if (typeof part === "object" && part !== null && !("text" in part)) {
      return { ...part, text: JSON.stringify(part) };
    }
    return part;
  });

  const message = await db
    .insert(messages)
    .values({
      id: nanoid(),
      chatId,
      role,
      parts: processedParts,
      attachments,
      createdAt: new Date(),
    })
    .returning();
  return message[0];
}

export async function getMessages(chatId: string) {
  return await db
    .select()
    .from(messages)
    .where(eq(messages.chatId, chatId))
    .orderBy(messages.createdAt);
}

export async function saveVote(
  chatId: string,
  messageId: string,
  isUpvoted: boolean
) {
  const vote = await db
    .insert(votes)
    .values({
      chatId,
      messageId,
      isUpvoted: isUpvoted ? "true" : "false",
    })
    .returning();
  return vote[0];
}

export async function getVotes(chatId: string) {
  return await db.select().from(votes).where(eq(votes.chatId, chatId));
}

export async function deleteVote(chatId: string, messageId: string) {
  await db
    .delete(votes)
    .where(and(eq(votes.chatId, chatId), eq(votes.messageId, messageId)));
}

export async function saveChatLegacy({
  id,
  userId,
  title,
}: {
  id: string;
  userId: string;
  title: string;
}): Promise<void> {
  console.log("Saving chat:", { id, userId, title });

  try {
    await db.insert(chats).values({
      id,
      userId,
      title,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log("Chat saved successfully");
  } catch (error) {
    console.error("Error saving chat:", error);
    throw error;
  }
}

export async function saveMessages({
  messages: chatMessages,
}: {
  messages: ChatMessage[];
}): Promise<void> {
  console.log("Saving messages:", chatMessages);

  try {
    if (chatMessages.length > 0) {
      // Update the chat's lastMessageAt timestamp when saving messages
      const latestMessage = chatMessages[chatMessages.length - 1];
      console.log("Updating chat last message time:", latestMessage.chatId);

      // Update the chat's lastMessageAt timestamp
      await db
        .update(chats)
        .set({
          lastMessageAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(chats.id, latestMessage.chatId));

      // Insert the messages
      await db.insert(messages).values(
        chatMessages.map((message) => {
          return {
            id: message.id,
            chatId: message.chatId,
            role: message.role,
            parts: message.parts,
            attachments: message.attachments || [],
            createdAt: message.createdAt || new Date(),
          };
        })
      );
    }

    console.log("Messages saved successfully");
  } catch (error) {
    console.error("Error in chat processing:", error);
    throw error;
  }
}

export async function getChatById({
  id,
}: {
  id: string;
}): Promise<Chat | null> {
  console.log("Getting chat by ID:", id);

  try {
    const result = await db.query.chats.findFirst({
      where: eq(chats.id, id),
    });

    return result || null;
  } catch (error) {
    console.error("Error getting chat by ID:", error);
    throw error;
  }
}

export async function getChatMessages({
  chatId,
}: {
  chatId: string;
}): Promise<ChatMessage[]> {
  console.log("Getting messages for chat:", chatId);

  try {
    const result = await db.query.messages.findMany({
      where: eq(messages.chatId, chatId),
      orderBy: [asc(messages.createdAt)],
    });

    return result.map((msg) => {
      return {
        id: msg.id,
        chatId: msg.chatId,
        role: msg.role,
        parts: msg.parts as any,
        attachments: (msg.attachments as any[]) || [],
        createdAt: msg.createdAt,
      };
    });
  } catch (error) {
    console.error("Error getting chat messages:", error);
    throw error;
  }
}

export async function getUserChats({
  userId,
}: {
  userId: string;
}): Promise<Chat[]> {
  console.log("Getting chats for user:", userId);

  try {
    const result = await db.query.chats.findMany({
      where: eq(chats.userId, userId),
      orderBy: [desc(chats.updatedAt)],
    });

    return result;
  } catch (error) {
    console.error("Error getting user chats:", error);
    throw error;
  }
}

export async function getChatsByUserId({
  id,
  limit = 10,
  startingAfter = null,
  endingBefore = null,
}: {
  id: string;
  limit?: number;
  startingAfter?: string | null;
  endingBefore?: string | null;
}): Promise<Chat[]> {
  console.log("Getting paginated chats for user:", id, {
    limit,
    startingAfter,
    endingBefore,
  });

  try {
    let query = db.query.chats.findMany({
      where: eq(chats.userId, id),
      orderBy: [desc(chats.lastMessageAt)],
      limit,
    });

    // Apply pagination if needed
    if (startingAfter) {
      query = db.query.chats.findMany({
        where: eq(chats.userId, id),
        orderBy: [desc(chats.lastMessageAt)],
        limit,
        offset: parseInt(startingAfter),
      });
    }

    const result = await query;
    return result;
  } catch (error) {
    console.error("Error getting paginated chats:", error);
    throw error;
  }
}

export async function deleteChatById({ id }: { id: string }): Promise<void> {
  console.log("Deleting chat:", id);

  try {
    // Delete the chat (messages will be deleted automatically due to cascade)
    await db.delete(chats).where(eq(chats.id, id));
    console.log("Chat deleted successfully");
  } catch (error) {
    console.error("Error deleting chat:", error);
    throw error;
  }
}

// Get the most recent messages for a user (for chat history sidebar)
export async function getRecentChatsWithLastMessage({
  userId,
  limit = 10,
}: {
  userId: string;
  limit?: number;
}): Promise<{ chat: Chat; lastMessage?: ChatMessage }[]> {
  console.log("Getting recent chats with last message for user:", userId);

  try {
    // Get the user's chats
    const chats = await getUserChats({ userId });

    // If no chats are found, return an empty array
    if (!chats || chats.length === 0) {
      return [];
    }

    // For each chat, get the last message
    const results = await Promise.all(
      chats.map(async (chat) => {
        const messages = await getChatMessages({ chatId: chat.id });

        // Sort messages by createdAt in descending order to get the most recent
        const sortedMessages = messages.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        const lastMessage =
          sortedMessages.length > 0 ? sortedMessages[0] : undefined;

        return {
          chat,
          lastMessage,
        };
      })
    );

    // Sort by lastMessageAt or createdAt in descending order
    return results
      .sort((a, b) => {
        const aDate = a.chat.lastMessageAt || a.chat.createdAt || new Date();
        const bDate = b.chat.lastMessageAt || b.chat.createdAt || new Date();

        return new Date(bDate).getTime() - new Date(aDate).getTime();
      })
      .slice(0, limit); // Limit the number of results
  } catch (error) {
    console.error("Error getting recent chats with last message:", error);
    throw error;
  }
}
