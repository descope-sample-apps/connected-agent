import { UIMessage } from "ai";
import { eq, desc, asc, and, sql } from "drizzle-orm";
import { db } from "./index";
import { chats, messages, votes, usage } from "./schema";
import { nanoid } from "nanoid";

// Types for database operations
export interface ChatMessage {
  id: string;
  chatId: string;
  role: string;
  parts: any;
  attachments?: Array<any>;
  metadata?: any;
  createdAt: Date;
}

// Use the inferred types from our schema
export type Chat = typeof chats.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Vote = typeof votes.$inferSelect;

// These are placeholder implementations that can be replaced with actual database operations
// using Vercel Postgres, Firebase, Supabase, or other databases

export async function saveChat(userId: string, title: string, id?: string) {
  try {
    // Use upsert functionality to avoid duplicate key errors
    const chatId = id || nanoid();

    // First, try to update if the chat exists
    const updated = await db
      .update(chats)
      .set({
        title,
        updatedAt: new Date(),
      })
      .where(eq(chats.id, chatId))
      .returning();

    // If we managed to update an existing record, return it
    if (updated && updated.length > 0) {
      console.log("Chat updated successfully:", chatId);
      return updated[0];
    }

    // If no rows were updated, insert a new record
    const inserted = await db
      .insert(chats)
      .values({
        id: chatId,
        userId,
        title,
        createdAt: new Date(),
        updatedAt: new Date(),
        visibility: "private",
      })
      .onConflictDoUpdate({
        target: chats.id,
        set: {
          title,
          updatedAt: new Date(),
        },
      })
      .returning();

    console.log("Chat inserted/updated successfully:", chatId);
    return inserted[0];
  } catch (error) {
    console.error("Error in saveChat:", error);
    throw error;
  }
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

  // Filter out any parts with empty text
  processedParts = processedParts.filter((part: any) => {
    if (typeof part === "object" && part !== null && "text" in part) {
      return part.text && part.text.trim() !== "";
    }
    return true;
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
  console.log(`Saving ${chatMessages.length} messages`);

  try {
    if (chatMessages.length === 0) {
      console.log("No messages to save");
      return;
    }

    // Update the chat's lastMessageAt timestamp when saving messages
    const latestMessage = chatMessages[chatMessages.length - 1];
    const chatId = latestMessage.chatId;

    console.log("Updating chat last message time for chat:", chatId);

    // Get existing message IDs for this chat to avoid duplicates
    const existingMessagesResult = await db
      .select({ id: messages.id })
      .from(messages)
      .where(eq(messages.chatId, chatId));

    const existingMessageIds = new Set(existingMessagesResult.map((m) => m.id));

    // Filter out messages that already exist
    const newMessages = chatMessages.filter(
      (message) => !existingMessageIds.has(message.id)
    );

    if (newMessages.length === 0) {
      console.log(
        "All messages already exist in the database, skipping insert"
      );
      return;
    }

    // Only update the chat timestamp if we have new messages
    await db
      .update(chats)
      .set({
        lastMessageAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(chats.id, chatId));

    // Prepare messages with proper date handling
    const messagesToInsert = newMessages.map((message) => {
      // Ensure we have a valid date object for createdAt
      let createdAt: Date;
      try {
        // If createdAt exists and is valid
        if (
          message.createdAt &&
          (message.createdAt instanceof Date ||
            typeof message.createdAt === "string" ||
            typeof message.createdAt === "number")
        ) {
          createdAt = new Date(message.createdAt);
          // Verify it's a valid date
          if (isNaN(createdAt.getTime())) {
            throw new Error("Invalid date");
          }
        } else {
          // Default to current time
          createdAt = new Date();
        }
      } catch (e) {
        console.warn("Invalid date in message, using current date instead");
        createdAt = new Date();
      }

      // Filter out empty parts
      const filteredParts = Array.isArray(message.parts)
        ? message.parts.filter((part: any) => {
            if (
              typeof part === "object" &&
              part !== null &&
              part.type === "text" &&
              "text" in part
            ) {
              return part.text && part.text.trim() !== "";
            }
            return true; // Keep non-text parts
          })
        : message.parts;

      return {
        id: message.id,
        chatId: message.chatId,
        role: message.role,
        parts: filteredParts,
        attachments: message.attachments || [],
        metadata: message.metadata || {},
        createdAt: createdAt,
      };
    });

    // Insert only new messages
    await db.insert(messages).values(messagesToInsert);

    console.log(`${newMessages.length} new messages saved successfully`);
  } catch (error) {
    console.error("Error saving messages:", error);
    throw error;
  }
}

export async function getChatById({
  id,
}: {
  id: string;
}): Promise<Chat | null> {
  try {
    // Early return if id is undefined, null, or empty
    if (!id) {
      console.warn("getChatById called with empty or undefined ID");
      return null;
    }

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
        metadata: msg.metadata || {},
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

    // Use a Map to ensure unique chat IDs
    const uniqueChats = new Map<
      string,
      { chat: Chat; lastMessage?: ChatMessage }
    >();

    // For each chat, get the last message
    await Promise.all(
      chats.map(async (chat) => {
        const messages = await getChatMessages({ chatId: chat.id });

        // Sort messages by createdAt in descending order to get the most recent
        const sortedMessages = messages.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        const lastMessage =
          sortedMessages.length > 0 ? sortedMessages[0] : undefined;

        // Only add to the Map if we don't already have this chat
        if (!uniqueChats.has(chat.id)) {
          uniqueChats.set(chat.id, {
            chat,
            lastMessage,
          });
        }
      })
    );

    // Convert Map to array and sort by lastMessageAt or createdAt
    const results = Array.from(uniqueChats.values()).sort((a, b) => {
      const aDate = a.chat.lastMessageAt || a.chat.createdAt || new Date();
      const bDate = b.chat.lastMessageAt || b.chat.createdAt || new Date();

      return new Date(bDate).getTime() - new Date(aDate).getTime();
    });

    // Return the limited number of results
    return results.slice(0, limit);
  } catch (error) {
    console.error("Error getting recent chats with last message:", error);
    throw error;
  }
}

// Usage tracking functions
export async function getUserUsage(userId: string) {
  try {
    const result = await db.query.usage.findFirst({
      where: eq(usage.userId, userId),
    });

    if (!result) {
      // Create new usage record if none exists
      const newUsage = {
        id: nanoid(),
        userId,
        messageCount: 0,
        lastResetAt: new Date(),
        monthlyLimit: 100,
      };
      await db.insert(usage).values(newUsage);
      return newUsage;
    }

    // Check if we need to reset the monthly count
    const lastReset = new Date(result.lastResetAt);
    const now = new Date();
    if (
      lastReset.getMonth() !== now.getMonth() ||
      lastReset.getFullYear() !== now.getFullYear()
    ) {
      // Reset the count for the new month
      await db
        .update(usage)
        .set({
          messageCount: 0,
          lastResetAt: now,
        })
        .where(eq(usage.id, result.id));
      return { ...result, messageCount: 0, lastResetAt: now };
    }

    return result;
  } catch (error) {
    console.error("Error getting user usage:", error);
    throw error;
  }
}

export async function incrementUserUsage(userId: string) {
  try {
    const userUsage = await getUserUsage(userId);

    if (userUsage.messageCount >= userUsage.monthlyLimit) {
      throw new Error("Monthly usage limit exceeded");
    }

    await db
      .update(usage)
      .set({
        messageCount: userUsage.messageCount + 1,
        updatedAt: new Date(),
      })
      .where(eq(usage.id, userUsage.id));

    return userUsage.messageCount + 1;
  } catch (error) {
    console.error("Error incrementing user usage:", error);
    throw error;
  }
}
