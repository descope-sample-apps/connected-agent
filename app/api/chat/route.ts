import {
  UIMessage,
  appendResponseMessages,
  createDataStreamResponse,
  smoothStream,
  streamText,
} from "ai";
import { session } from "@descope/nextjs-sdk/server";
import { systemPrompt } from "@/lib/ai/prompts";
import {
  deleteChatById,
  getChatById,
  saveChat,
  saveMessages,
} from "@/lib/db/queries";
import {
  generateUUID,
  getMostRecentUserMessage,
  getTrailingMessageId,
  isCrmRelatedQuery,
} from "@/lib/utils";
import { createDocument } from "@/lib/ai/tools/create-document";
import { getWeather } from "@/lib/ai/tools/get-weather";
import { myProvider } from "@/lib/ai/providers";
import { getGoogleCalendarToken, getCRMToken } from "@/lib/descope";
import { parseRelativeDate, getCurrentDateContext } from "@/lib/date-utils";
import { isProductionEnvironment } from "@/lib/constants";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { nanoid } from "nanoid";
import { z } from "zod";

export const maxDuration = 60;

// Helper function to extract a title from a message
function extractTitle(message: UIMessage): string {
  if (!message || !message.parts || !message.parts.length) {
    return "New Chat";
  }

  const firstPart = message.parts[0];
  let textContent = "";

  if (typeof firstPart === "string") {
    textContent = firstPart;
  } else if (firstPart && typeof firstPart === "object") {
    if ("text" in firstPart && firstPart.text) {
      textContent = String(firstPart.text);
    } else if ("content" in firstPart && firstPart.content) {
      textContent = String(firstPart.content);
    } else {
      try {
        textContent = JSON.stringify(firstPart);
      } catch (e) {
        textContent = String(firstPart);
      }
    }
  } else if (firstPart !== undefined) {
    textContent = String(firstPart);
  }

  // If we still don't have any text content, use a default title
  if (!textContent || textContent.trim().length === 0) {
    return "New Chat";
  }

  // Clean up the text content and limit its length
  textContent = textContent.trim();
  return textContent.slice(0, 30) + (textContent.length > 30 ? "..." : "");
}

// Create a wrapper for dataStream that handles the append method
function createStreamAdapter(dataStream: any) {
  return {
    append: (data: any) => {
      try {
        dataStream.append(data);
      } catch (error) {
        console.error("Error appending to stream:", error);
      }
    },
  };
}

export async function POST(request: Request) {
  try {
    const {
      id,
      messages,
      selectedChatModel = DEFAULT_CHAT_MODEL,
    }: {
      id: string;
      messages: Array<UIMessage>;
      selectedChatModel?: string;
    } = await request.json();

    const userSession = await session();

    if (!userSession?.token?.sub) {
      return new Response("Unauthorized", { status: 401 });
    }

    const userId = userSession.token.sub;
    const userMessage = getMostRecentUserMessage(messages);

    if (!userMessage) {
      return new Response("No user message found", { status: 400 });
    }

    // Check for existing chat or create a new one
    const chat = await getChatById({ id });

    if (!chat) {
      const title = extractTitle(userMessage);
      await saveChat(userId, title, id);
    } else {
      if (chat.userId !== userId) {
        return new Response("Unauthorized", { status: 401 });
      }
    }

    // Save the user message
    await saveMessages({
      messages: [
        {
          id: nanoid(),
          chatId: id,
          role: "user",
          parts: userMessage.parts,
          attachments: userMessage.experimental_attachments ?? [],
          createdAt: new Date(),
        },
      ],
    });

    // Return a streaming response
    return createDataStreamResponse({
      execute: (dataStream) => {
        // Create a wrapper for the dataStream with proper append method
        const streamAdapter = createStreamAdapter(dataStream);

        const result = streamText({
          model: myProvider.languageModel(selectedChatModel),
          system: systemPrompt({ selectedChatModel }),
          messages,
          maxSteps: 5,
          // @ts-ignore - Type compatibility issue with smoothStream and the AI SDK
          experimental_transform: smoothStream({ chunking: "word" }),
          experimental_generateMessageId: generateUUID,
          tools: {
            getWeather,
            createDocument: createDocument({
              session: userSession,
              dataStream: streamAdapter,
            }),
            parseDate: {
              description:
                "Parse a relative date into a formatted date and time",
              parameters: z.object({
                dateString: z
                  .string()
                  .describe(
                    'The date string to parse (e.g., "tomorrow", "next Friday")'
                  ),
                timeString: z
                  .string()
                  .optional()
                  .describe('The time string to parse (e.g., "3pm", "15:00")'),
              }),
              execute: async ({ dateString, timeString = "12:00" }) => {
                try {
                  const dateContext = getCurrentDateContext();
                  const parsedDate = parseRelativeDate(dateString, timeString);

                  return {
                    success: true,
                    dateContext,
                    parsedDate,
                  };
                } catch (error) {
                  console.error(
                    `Error parsing date: "${dateString}" at time "${timeString}"`,
                    error
                  );

                  // Use current date as fallback
                  const now = new Date();
                  return {
                    success: false,
                    error: `Could not parse date: ${dateString}`,
                    fallbackDate: now.toISOString(),
                    dateContext: getCurrentDateContext(),
                  };
                }
              },
            },
          },
          onFinish: async ({ response }) => {
            if (userId) {
              try {
                // Get the assistant messages with type assertion
                const assistantMessages = response.messages.filter(
                  (message) => message.role === "assistant"
                );

                const assistantId = getTrailingMessageId({
                  messages: assistantMessages as any,
                });

                if (!assistantId) {
                  throw new Error("No assistant message found!");
                }

                // Find the last assistant message
                const assistantMessage =
                  assistantMessages[assistantMessages.length - 1];

                if (!assistantMessage) {
                  throw new Error("No assistant message found!");
                }

                // Get a simple text representation for the database
                let messageText = "";
                try {
                  if (typeof assistantMessage.content === "string") {
                    messageText = assistantMessage.content;
                  }
                } catch (e) {
                  console.error("Error extracting message text:", e);
                  messageText = "AI response";
                }

                // Save a simplified message that won't cause type errors
                await saveMessages({
                  messages: [
                    {
                      id: assistantId,
                      chatId: id,
                      role: "assistant",
                      parts: [{ text: messageText }],
                      attachments: [],
                      createdAt: new Date(),
                    },
                  ],
                });
              } catch (error) {
                console.error("Failed to save chat:", error);
              }
            }
          },
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: "stream-text",
          },
        });

        result.consumeStream();
        result.mergeIntoDataStream(dataStream, { sendReasoning: true });
      },
      onError: (error) => {
        console.error("Error in chat processing:", error);
        return "Sorry, there was an error processing your request. Please try again.";
      },
    });
  } catch (error) {
    console.error("Error in POST handler:", error);
    return new Response("An error occurred while processing your request!", {
      status: 500,
    });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new Response("Not Found", { status: 404 });
  }

  const userSession = await session();
  const userId = userSession?.token?.sub;

  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const chat = await getChatById({ id });

    if (!chat) {
      return new Response("Not Found", { status: 404 });
    }

    if (chat.userId !== userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    await deleteChatById({ id });

    return new Response("Chat deleted", { status: 200 });
  } catch (error) {
    console.error("Error in DELETE handler:", error);
    return new Response("An error occurred while processing your request!", {
      status: 500,
    });
  }
}
