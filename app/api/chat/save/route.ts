import { session } from "@descope/nextjs-sdk/server";
import { saveChat, saveMessages } from "@/lib/db/queries";
import { nanoid } from "nanoid";

export async function POST(request: Request) {
  try {
    // Get user session to authenticate
    const userSession = await session();
    if (!userSession?.token?.sub) {
      return new Response("Unauthorized", { status: 401 });
    }

    const userId = userSession.token.sub;
    const body = await request.json();

    const { id, title, messages } = body;

    if (!id) {
      return new Response("Chat ID is required", { status: 400 });
    }

    console.log(
      `Processing save request for chat ${id} with ${
        messages?.length || 0
      } messages`
    );

    // First, try to save the chat metadata
    try {
      await saveChat(userId, title || "New Chat", id);
    } catch (error) {
      console.error("Error saving chat metadata:", error);
      return new Response(
        JSON.stringify({
          error: "Failed to save chat metadata",
          details: error instanceof Error ? error.message : String(error),
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Then, try to save the messages if provided
    let messagesSaved = false;
    if (messages && Array.isArray(messages) && messages.length > 0) {
      try {
        // Ensure all messages have valid properties
        const formattedMessages = messages.map((message) => {
          // Ensure each message has required fields
          if (!message.id) {
            message.id = nanoid();
          }

          // Make sure chatId matches the chat we're saving
          message.chatId = id;

          // Ensure we have valid date objects
          let createdAt = new Date();
          if (message.createdAt) {
            try {
              createdAt = new Date(message.createdAt);
              if (isNaN(createdAt.getTime())) {
                createdAt = new Date();
              }
            } catch (e) {
              // Use default date if parsing fails
            }
          }

          return {
            id: message.id,
            chatId: id,
            role: message.role,
            parts: message.parts || [],
            attachments: message.attachments || [],
            metadata: message.metadata || {},
            createdAt,
          };
        });

        // Save messages to database
        await saveMessages({ messages: formattedMessages });
        messagesSaved = true;
      } catch (error) {
        console.error("Error saving chat messages:", error);
        // We continue since chat metadata is saved successfully
        return new Response(
          JSON.stringify({
            success: true,
            warning: "Chat metadata saved but messages failed to save",
            details: error instanceof Error ? error.message : String(error),
          }),
          {
            status: 207,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        messagesSaved,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error in chat save endpoint:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to save chat",
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}
