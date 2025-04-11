// Import API initialization to ensure all tools are registered
import "@/app/api/_init";

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
import {
  CRMDealsTool,
  fetchCRMContacts,
  fetchCRMDeals,
  fetchDealStakeholders,
} from "@/lib/tools/crm";
import { toolRegistry } from "@/lib/tools/base";
import { CalendarTool } from "@/lib/tools/calendar";
import { CalendarListTool } from "@/lib/tools/calendar-list";
import { searchContact } from "@/lib/api/crm-utils";

// Add this interface definition
interface DataStreamWithAppend {
  append: (data: any) => void;
  close?: () => void;
}

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
    close: () => {
      // Add a close method to match the DataStreamWithAppend interface
      try {
        if (typeof dataStream.close === "function") {
          dataStream.close();
        }
      } catch (error) {
        console.error("Error closing stream:", error);
      }
    },
  };
}

// Add link detection and formatting for better display
function formatLinksForDisplay(content: string): string {
  // Check if the content has markdown links
  const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let formattedContent = content;

  console.log("formattedContent", formattedContent);

  // Replace markdown links with a special format the frontend can recognize and render
  formattedContent = formattedContent.replace(
    markdownLinkRegex,
    (match, text, url) => {
      // Create a special format that's easy for the frontend to parse
      return `<link:${url}:${text}>`;
    }
  );

  // Also detect plain URLs and format them
  const urlRegex = /(https?:\/\/[^\s]+)(?=[,.!?;:]?(\s|$))/g;
  formattedContent = formattedContent.replace(urlRegex, (match, url) => {
    // Don't replace URLs that are already inside our special link format
    if (formattedContent.includes(`<link:${url}:`)) {
      return match;
    }
    return `<link:${url}:${url}>`;
  });

  return formattedContent;
}

// Define the new CRM tool schemas
const crmContactsSchema = {
  type: "function",
  function: {
    name: "get_crm_contacts",
    description: "Get contact information from the CRM system",
    parameters: {
      type: "object",
      properties: {
        search: {
          type: "string",
          description:
            "Optional search term to filter contacts by name, email, or company",
        },
      },
      required: [],
    },
  },
};

const crmContactSearchSchema = {
  type: "function",
  function: {
    name: "search_crm_contact_by_name",
    description: "Search for a specific contact by name in the CRM system",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description:
            "The name of the contact to search for (e.g., 'John Doe')",
        },
      },
      required: ["name"],
    },
  },
};

const crmDealsSchema = {
  type: "function",
  function: {
    name: "get_crm_deals",
    description: "Get deal information from the CRM system",
    parameters: {
      type: "object",
      properties: {
        dealId: {
          type: "string",
          description: "Optional specific deal ID to retrieve",
        },
        contactId: {
          type: "string",
          description: "Optional contact ID to filter deals by contact",
        },
        stage: {
          type: "string",
          description:
            "Optional deal stage to filter by (discovery, proposal, negotiation, closed_won, closed_lost)",
          enum: [
            "discovery",
            "proposal",
            "negotiation",
            "closed_won",
            "closed_lost",
          ],
        },
      },
      required: [],
    },
  },
};

const dealStakeholdersSchema = {
  type: "function",
  function: {
    name: "get_deal_stakeholders",
    description:
      "Get all stakeholders (contacts) associated with a specific deal",
    parameters: {
      type: "object",
      properties: {
        dealId: {
          type: "string",
          description: "The deal ID to get stakeholders for",
        },
      },
      required: ["dealId"],
    },
  },
};

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

    // Initialize CRM tools
    const crmDealsTool = new CRMDealsTool();

    // Get tools from registry
    const calendarTool = toolRegistry.getTool("google-calendar");
    const calendarListTool = toolRegistry.getTool("google-calendar-list");
    const crmContactsTool = toolRegistry.getTool("crm-contacts");
    const googleMeetTool = toolRegistry.getTool("google-meet");

    // Define the tools object
    const toolsObject: any = {
      getWeather,
      parseDate: {
        description: "Parse a relative date into a formatted date and time",
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
        execute: async ({
          dateString,
          timeString = "12:00",
        }: {
          dateString: string;
          timeString?: string;
        }) => {
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
      // Add calendar list tool
      listCalendarEvents: {
        description: "List upcoming events from Google Calendar",
        parameters: z.object({
          maxResults: z
            .number()
            .default(5)
            .describe("Number of events to fetch"),
          timeMin: z
            .string()
            .optional()
            .describe("Start time for the range (ISO format)"),
          timeMax: z
            .string()
            .optional()
            .describe("End time for the range (ISO format)"),
          calendarId: z
            .string()
            .optional()
            .describe("Calendar ID to fetch events from"),
        }),
        execute: async (data: any) => {
          if (!calendarListTool) {
            return {
              success: false,
              error: "Calendar list tool not available",
              ui: {
                type: "connection_required",
                service: "google-calendar",
                message: "Please connect your Google Calendar to view events",
                connectButton: {
                  text: "Connect Google Calendar",
                  action: "connection://google-calendar",
                },
              },
            };
          }

          return await calendarListTool.execute(userId, data);
        },
      },
      // Add CRM deals tool
      getCRMDeals: {
        description: "Get all deals or a specific deal by ID from the CRM",
        parameters: z.object({
          id: z
            .string()
            .optional()
            .describe("Deal ID (optional, leave empty to get all deals)"),
        }),
        execute: async ({ id }: { id?: string }) => {
          return await crmDealsTool.execute(userId, { id });
        },
      },
      // Add CRM contacts lookup tool
      getCRMContacts: {
        description: "Get contact information from the CRM",
        parameters: z.object({
          name: z
            .string()
            .optional()
            .describe("Contact name to search for (e.g., 'Chris')"),
          email: z.string().optional().describe("Contact email to search for"),
          id: z.string().optional().describe("Contact ID if known"),
        }),
        execute: async ({
          name,
          email,
          id,
        }: {
          name?: string;
          email?: string;
          id?: string;
        }) => {
          try {
            if (!crmContactsTool) {
              return {
                success: false,
                error: "CRM contacts tool not available",
                message:
                  "Unable to access CRM contacts. Please connect your CRM.",
                ui: {
                  type: "connection_required",
                  service: "custom-crm",
                  message: "Please connect your CRM to access contacts",
                  connectButton: {
                    text: "Connect CRM",
                    action: "connection://custom-crm",
                  },
                },
              };
            }

            // If only a name is provided, let's first search for the contact
            if (name && !email && !id) {
              console.log(
                "[getCRMContacts] Searching for contact by name:",
                name
              );

              // Get CRM access token
              const tokenResponse = await getCRMToken(userId, "tool_calling");

              if (!tokenResponse) {
                return {
                  success: false,
                  error: "Failed to get CRM access token",
                  message: "CRM connection is required to look up contacts.",
                  ui: {
                    type: "connection_required",
                    service: "custom-crm",
                    message: "Please connect your CRM to access contacts",
                    connectButton: {
                      text: "Connect CRM",
                      action: "connection://custom-crm",
                    },
                  },
                };
              }

              // Use type guard to safely access token
              if (
                "token" in tokenResponse &&
                tokenResponse.token &&
                tokenResponse.token.accessToken
              ) {
                try {
                  const result = await searchContact(
                    tokenResponse.token.accessToken,
                    name
                  );

                  if (result.success) {
                    // Exact match found
                    if (
                      result.data.contact &&
                      !result.data.partialMatch &&
                      !result.data.partialMatches
                    ) {
                      console.log(
                        "[getCRMContacts] Found exact contact match:",
                        result.data.contact.name
                      );
                      return {
                        success: true,
                        data: result.data.contact,
                        message: `Found contact information for ${result.data.contact.name}: ${result.data.contact.email}`,
                      };
                    }
                    // Single partial match found - ask for confirmation
                    else if (
                      result.data.partialMatch &&
                      result.data.contact &&
                      result.data.needsConfirmation
                    ) {
                      console.log(
                        "[getCRMContacts] Found partial match, asking for confirmation:",
                        result.data.contact.name
                      );
                      const contact = result.data.contact;
                      return {
                        success: true,
                        data: {
                          partialMatch: true,
                          contact: contact,
                          needsConfirmation: true,
                        },
                        message: `I found ${contact.name} (${
                          contact.email
                        }) from ${
                          contact.company || "unknown company"
                        } in the CRM. Is this the person you're looking for?`,
                      };
                    }
                    // Multiple matches found - present options
                    else if (
                      result.data.partialMatches &&
                      result.data.contacts &&
                      result.data.needsConfirmation
                    ) {
                      console.log(
                        "[getCRMContacts] Found multiple partial matches, presenting options"
                      );
                      return {
                        success: true,
                        data: {
                          partialMatches: true,
                          contacts: result.data.contacts,
                          needsConfirmation: true,
                        },
                        message:
                          result.data.message ||
                          `I found multiple people that might match "${name}". Which one did you mean?`,
                      };
                    }
                    // No contact found
                    else if (result.data.notFound) {
                      console.log(
                        "[getCRMContacts] No contact found with name:",
                        name
                      );
                      return {
                        success: false,
                        error: "Contact not found",
                        message: `I searched the CRM but couldn't find any contact named "${name}". Would you like to provide an email to create this contact?`,
                      };
                    }
                  }

                  // If there was an error or unexpected result
                  console.log(
                    "[getCRMContacts] Search error or unexpected result:",
                    result
                  );
                  return {
                    success: false,
                    error: "Contact lookup error",
                    message: `I tried searching for "${name}" in the CRM but encountered an issue. Please check your CRM connection or try again later.`,
                  };
                } catch (error) {
                  console.error(
                    "[getCRMContacts] Error searching contact:",
                    error
                  );
                  return {
                    success: false,
                    error: "Contact search error",
                    message: `There was an error searching for "${name}" in the CRM.`,
                  };
                }
              } else {
                return {
                  success: false,
                  error: "CRM authentication required",
                  message:
                    "Unable to authenticate with the CRM service. Please reconnect your CRM in settings.",
                  ui: {
                    type: "connection_required",
                    service: "custom-crm",
                    message: "Please connect your CRM to access contacts",
                    connectButton: {
                      text: "Connect CRM",
                      action: "connection://custom-crm",
                    },
                  },
                };
              }
            }

            // If we have an email or ID, use the regular tool execution
            // Search by whatever parameter was provided
            const result = await crmContactsTool.execute(userId, {
              name,
              email,
              id,
            });

            return result;
          } catch (error) {
            console.error("Error looking up CRM contact:", error);
            return {
              success: false,
              error:
                error instanceof Error
                  ? error.message
                  : "Unknown error looking up contact",
              message:
                "There was an error retrieving contact information from your CRM.",
            };
          }
        },
      },
      // Add a dedicated Google Meet creation tool
      createGoogleMeet: {
        description: "Create a Google Meet meeting and get the meeting link",
        parameters: z.object({
          title: z.string().describe("Meeting title"),
          description: z.string().describe("Meeting description/agenda"),
          startTime: z
            .string()
            .describe("Start time in ISO format (e.g., 2023-05-01T09:00:00)"),
          duration: z.number().describe("Meeting duration in minutes"),
          attendees: z
            .array(z.string())
            .optional()
            .describe("Optional list of attendee emails"),
          timeZone: z
            .string()
            .optional()
            .describe("Time zone (optional, defaults to UTC)"),
          settings: z
            .object({
              muteUponEntry: z.boolean().optional(),
              joinBeforeHost: z.boolean().optional(),
            })
            .optional(),
        }),
        execute: async (data: any) => {
          try {
            if (!googleMeetTool) {
              return {
                success: false,
                error: "Google Meet tool not available",
                message:
                  "Unable to create Google Meet meetings. Please connect your Google Calendar.",
                ui: {
                  type: "connection_required",
                  service: "google-meet",
                  message:
                    "Please connect your Google Meet to create video conferences",
                  connectButton: {
                    text: "Connect Google Meet",
                    action: "connection://google-meet",
                  },
                },
              };
            }

            const result = await googleMeetTool.execute(userId, {
              title: data.title,
              description: data.description,
              startTime: data.startTime,
              duration: data.duration,
              attendees: data.attendees,
              timeZone: data.timeZone,
              settings: data.settings,
            });

            return result;
          } catch (error) {
            console.error("Error creating Google Meet:", error);
            return {
              success: false,
              error:
                error instanceof Error
                  ? error.message
                  : "Unknown error creating Google Meet",
              message:
                "There was an error creating your Google Meet. Please try again later.",
            };
          }
        },
      },
    };

    // Add calendar tool if available
    if (calendarTool) {
      toolsObject.createCalendarEvent = {
        description: "Create a calendar event for a meeting or appointment",
        parameters: z.object({
          title: z.string().describe("Event title"),
          description: z.string().describe("Event description"),
          startTime: z
            .string()
            .describe("Start time in ISO format (e.g., 2023-05-01T09:00:00)"),
          endTime: z
            .string()
            .describe("End time in ISO format (e.g., 2023-05-01T10:00:00)"),
          attendees: z
            .array(z.string())
            .describe("Array of attendee names or email addresses"),
          location: z.string().optional().describe("Event location (optional)"),
          timeZone: z
            .string()
            .optional()
            .describe("Time zone (optional, defaults to UTC)"),
          lookupContacts: z
            .boolean()
            .optional()
            .describe("Whether to look up attendee emails in CRM"),
        }),
        execute: async (data: any) => {
          try {
            // Process attendees with CRM lookup if requested
            if (data.attendees && data.attendees.length > 0) {
              const processedAttendees = [];

              for (const attendee of data.attendees) {
                // If it already has an email format, use it directly
                if (attendee.includes("@")) {
                  processedAttendees.push(attendee);
                  continue;
                }

                // Otherwise, try to look up the contact in CRM if we have the tool
                if (crmContactsTool && data.lookupContacts !== false) {
                  try {
                    const contactResult = await crmContactsTool.execute(
                      userId,
                      { name: attendee }
                    );

                    if (contactResult.success && contactResult.data) {
                      // Handle different possible response formats
                      let contactEmail = null;

                      if (Array.isArray(contactResult.data)) {
                        // If we got multiple results, use the first one
                        const firstContact = contactResult.data[0];
                        contactEmail = firstContact.email || null;
                      } else if (contactResult.data.email) {
                        // Single contact with email
                        contactEmail = contactResult.data.email;
                      }

                      if (contactEmail) {
                        processedAttendees.push(contactEmail);
                        continue;
                      }
                    }
                  } catch (error) {
                    console.error(
                      `Error looking up contact ${attendee}:`,
                      error
                    );
                  }
                }

                // If we couldn't find in CRM or don't have CRM tool, use placeholder
                const placeholderEmail = `${attendee
                  .toLowerCase()
                  .replace(/\s+/g, ".")}@example.com`;
                processedAttendees.push(placeholderEmail);
              }

              // Replace attendees with processed list
              data.attendees = processedAttendees;
            }

            return await calendarTool.execute(userId, data);
          } catch (error) {
            console.error("Error in calendar tool execution:", error);
            return {
              success: false,
              error:
                error instanceof Error
                  ? error.message
                  : "Unknown error creating calendar event",
              message:
                "There was an error creating your calendar event. Please try again later.",
            };
          }
        },
      };
    }

    // Add them to your existing tools array
    // Note: You should place this where your existing tools array is defined
    const tools = [
      // ... your existing tools ...
      crmContactsSchema,
      crmContactSearchSchema,
      crmDealsSchema,
      dealStakeholdersSchema,
    ];

    // Return a streaming response
    return createDataStreamResponse({
      execute: (dataStream) => {
        // Create a wrapper for the dataStream with proper append method
        const streamAdapter = createStreamAdapter(dataStream);

        // Initialize the document tool with the proper stream adapter
        toolsObject.createDocument = createDocument({
          session: userSession,
          dataStream: streamAdapter,
        });

        const result = streamText({
          model: myProvider.languageModel(selectedChatModel),
          system: systemPrompt({ selectedChatModel }),
          messages,
          maxSteps: 5,
          // @ts-ignore - Type compatibility issue with smoothStream and the AI SDK
          experimental_transform: smoothStream({ chunking: "word" }),
          experimental_generateMessageId: generateUUID,
          tools: toolsObject,
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
                    console.log("Initial messageText:", messageText);

                    // Look for special response handlers in the assistant message content
                    const toolResponses =
                      (assistantMessage as any).tool_responses || [];
                    console.log("Tool responses:", toolResponses);

                    // Check if any tool returned a formatted message
                    for (const toolResponse of toolResponses) {
                      if (toolResponse?.output?.formattedMessage) {
                        console.log(
                          "Found formatted message:",
                          toolResponse.output.formattedMessage
                        );
                        // For links generated by our tools, we want to make sure they're preserved and properly formatted
                        messageText = messageText.replace(
                          /Calendar event created successfully!|Google Meet created successfully!|I've created a Google Doc|Document created successfully/g,
                          toolResponse.output.formattedMessage
                        );
                        console.log(
                          "Message after tool response replacement:",
                          messageText
                        );
                      }
                    }

                    // Format remaining links for better display in the chat UI
                    console.log(
                      "About to format links for display. Message text:",
                      messageText
                    );
                    messageText = formatLinksForDisplay(messageText);
                    console.log("After formatLinksForDisplay:", messageText);
                  } else {
                    console.log(
                      "Assistant message content is not a string:",
                      typeof assistantMessage.content
                    );
                  }
                } catch (e: any) {
                  console.error("Error extracting message text:", e);
                  console.error("Error details:", {
                    message: e.message,
                    stack: e.stack,
                    assistantMessage: assistantMessage,
                  });
                  messageText = "AI response";
                }

                // Save a simplified message that won't cause type errors
                await saveMessages({
                  messages: [
                    {
                      id: assistantId,
                      chatId: id,
                      role: "assistant",
                      parts: [
                        {
                          text:
                            messageText +
                            // Check for direct reference to Google Meet connection in the message text
                            (messageText.includes(
                              "connect your Google Meet account"
                            ) || messageText.includes("connect to Google Meet")
                              ? `\n\n<connection:${JSON.stringify({
                                  type: "connection_required",
                                  service: "google-meet",
                                  message:
                                    "Please connect your Google Meet to create video conferences",
                                  connectButton: {
                                    text: "Connect Google Meet",
                                    action: "connection://google-meet",
                                  },
                                })}>`
                              : // Or check for other needed connections
                              messageText.includes(
                                  "connect your Google Calendar"
                                ) ||
                                messageText.includes(
                                  "connect to Google Calendar"
                                )
                              ? `\n\n<connection:${JSON.stringify({
                                  type: "connection_required",
                                  service: "google-calendar",
                                  message:
                                    "Please connect your Google Calendar to create events",
                                  connectButton: {
                                    text: "Connect Google Calendar",
                                    action: "connection://google-calendar",
                                  },
                                })}>`
                              : // Or try to extract from tool responses as fallback
                              extractUIElementsFromToolResponses(
                                  assistantMessage
                                )
                              ? `\n\n<connection:${JSON.stringify(
                                  extractUIElementsFromToolResponses(
                                    assistantMessage
                                  )
                                )}>`
                              : ""),
                        },
                      ],
                      attachments: [],
                      metadata: {},
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

// Add this function to extract UI elements from tool responses
function extractUIElementsFromToolResponses(message: any): any {
  try {
    // Check if the message contains tool responses
    const toolResponses = message.tool_responses || [];

    // Look for connection_required UI elements in any tool response
    for (const response of toolResponses) {
      if (response?.output?.ui?.type === "connection_required") {
        return response.output.ui;
      }
    }

    // Also check if the message content contains any connection text markers
    if (message.content && typeof message.content === "string") {
      const connectionRegex =
        /connect your (Google Meet|Google Calendar|CRM) account/i;
      const match = message.content.match(connectionRegex);

      if (match) {
        // Determine the service type from the content
        let service = "unknown";
        if (match[1].toLowerCase().includes("meet")) service = "google-meet";
        else if (match[1].toLowerCase().includes("calendar"))
          service = "google-calendar";
        else if (match[1].toLowerCase().includes("crm")) service = "crm";

        // Return a generic connection UI object
        return {
          type: "connection_required",
          service,
          message: `Please connect your ${match[1]} account to continue`,
          connectButton: {
            text: `Connect ${
              service === "google-calendar" ? "Google Calendar" : service
            }`,
            action: `connection://${service}`,
          },
        };
      }
    }

    return null;
  } catch (error) {
    console.error("Error extracting UI elements:", error);
    return null;
  }
}

// In the handleFunctionCall function, add handlers for our CRM tools
async function handleFunctionCall(
  functionCall: any,
  userId: string
): Promise<string> {
  const { name, arguments: args } = functionCall;

  // ... existing function handlers ...

  // Handle CRM contact lookups
  if (name === "get_crm_contacts") {
    const { search } = JSON.parse(args);
    try {
      // Get CRM access token
      const tokenResponse = await getCRMToken(userId, "tool_calling");
      if (!tokenResponse || !tokenResponse.token) {
        return JSON.stringify({
          error: "Failed to get CRM access token",
          ui: {
            type: "connection_required",
            service: "custom-crm",
            message: "CRM access is required to view contacts.",
            connectButton: {
              text: "Connect CRM",
              action: "connection://custom-crm",
            },
          },
        });
      }

      // Use our utility function
      const contacts = await fetchCRMContacts(
        tokenResponse.token.accessToken,
        search
      );
      return JSON.stringify(contacts);
    } catch (error) {
      console.error("Error in get_crm_contacts:", error);
      return JSON.stringify({ error: "Failed to retrieve contacts" });
    }
  }

  // Handle CRM contact lookup by name
  if (name === "search_crm_contact_by_name") {
    const { name: contactName } = JSON.parse(args);
    try {
      console.log(
        `[handleFunctionCall] Searching for contact by name: ${contactName}`
      );

      // Get CRM access token
      const tokenResponse = await getCRMToken(userId, "tool_calling");
      if (!tokenResponse || !tokenResponse.token) {
        return JSON.stringify({
          error: "Failed to get CRM access token",
          ui: {
            type: "connection_required",
            service: "custom-crm",
            message: "CRM access is required to search for contacts.",
            connectButton: {
              text: "Connect CRM",
              action: "connection://custom-crm",
            },
          },
        });
      }

      // Import the searchContact function
      const { searchContact } = await import("@/lib/api/crm-utils");

      // Search for the contact
      const result = await searchContact(
        tokenResponse.token.accessToken,
        contactName
      );
      console.log(
        `[handleFunctionCall] Contact search result:`,
        result.success ? "success" : "error"
      );

      return JSON.stringify(result);
    } catch (error) {
      console.error("Error in search_crm_contact_by_name:", error);
      return JSON.stringify({
        success: false,
        error: "Failed to search for contact",
        data: {
          message: `I encountered an error while searching for "${contactName}" in the CRM.`,
        },
      });
    }
  }

  // Handle CRM deal lookups
  if (name === "get_crm_deals") {
    const { dealId, contactId, stage } = JSON.parse(args);
    try {
      // Get CRM access token
      const tokenResponse = await getCRMToken(userId, "tool_calling");
      if (!tokenResponse || !tokenResponse.token) {
        return JSON.stringify({
          error: "Failed to get CRM access token",
          ui: {
            type: "connection_required",
            service: "custom-crm",
            message: "CRM access is required to view deals.",
            connectButton: {
              text: "Connect CRM",
              action: "connection://custom-crm",
            },
          },
        });
      }

      // Use our utility function
      const deals = await fetchCRMDeals(
        tokenResponse.token.accessToken,
        dealId,
        contactId,
        stage
      );
      return JSON.stringify(deals);
    } catch (error) {
      console.error("Error in get_crm_deals:", error);
      return JSON.stringify({ error: "Failed to retrieve deals" });
    }
  }

  // Handle CRM deal stakeholders
  if (name === "get_deal_stakeholders") {
    const { dealId } = JSON.parse(args);
    try {
      // Get CRM access token
      const tokenResponse = await getCRMToken(userId, "tool_calling");
      if (!tokenResponse || !tokenResponse.token) {
        return JSON.stringify({
          error: "Failed to get CRM access token",
          ui: {
            type: "connection_required",
            service: "custom-crm",
            message: "CRM access is required to view deal stakeholders.",
            connectButton: {
              text: "Connect CRM",
              action: "connection://custom-crm",
            },
          },
        });
      }

      // Use our utility function
      const stakeholders = await fetchDealStakeholders(
        tokenResponse.token.accessToken,
        dealId
      );
      return JSON.stringify(stakeholders);
    } catch (error) {
      console.error("Error in get_deal_stakeholders:", error);
      return JSON.stringify({ error: "Failed to retrieve deal stakeholders" });
    }
  }

  // Default response for unhandled functions
  return JSON.stringify({
    error: `Function ${name} not implemented or not authorized`,
  });
}
