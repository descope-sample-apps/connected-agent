// Import API initialization to ensure all tools are registered
import "@/app/api/_init";

import {
  UIMessage,
  appendResponseMessages,
  createDataStreamResponse,
  smoothStream,
  streamText,
  Message,
  CoreMessage,
} from "ai";
import { session } from "@descope/nextjs-sdk/server";
import { systemPrompt } from "@/lib/ai/prompts";
import {
  deleteChatById,
  getChatById,
  saveChat,
  saveMessages,
  incrementUserUsage,
} from "@/lib/db/queries";
import {
  generateUUID,
  getMostRecentUserMessage,
  getTrailingMessageId,
} from "@/lib/utils";
import { createDocument } from "@/lib/ai/tools/create-document";
import { getWeather } from "@/lib/ai/tools/get-weather";
import { myProvider } from "@/lib/ai/providers";
import { getCRMToken } from "@/lib/descope";
import { parseRelativeDate, getCurrentDateContext } from "@/lib/date-utils";
import { isProductionEnvironment } from "@/lib/constants";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { nanoid } from "nanoid";
import { z } from "zod";
import { CRMDealsTool } from "@/lib/tools/crm";
import { toolRegistry } from "@/lib/tools/base";
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
  // Check if dataStream already has an append method
  if (dataStream && typeof dataStream.append === "function") {
    console.log("Using existing append method");
    return dataStream;
  }

  // Create a wrapper with append method
  return {
    append: (data: any) => {
      try {
        // If dataStream has a write method, use that instead
        if (dataStream && typeof dataStream.write === "function") {
          console.log("Using write method for stream");
          dataStream.write(JSON.stringify(data) + "\n");
        } else if (dataStream && typeof dataStream.append === "function") {
          console.log("Using append method for stream");
          dataStream.append(data);
        } else {
          console.warn("dataStream does not have append or write method");
          // Try to use the dataStream directly if it's a function
          if (typeof dataStream === "function") {
            console.log("Using dataStream as function");
            dataStream(data);
          }
        }
      } catch (error) {
        console.error("Error appending to stream:", error);
      }
    },
    close: () => {
      try {
        if (dataStream && typeof dataStream.close === "function") {
          console.log("Closing stream");
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

interface MessagePart {
  type: string;
  text?: string;
  content?: any;
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | MessagePart[] | any;
  parts?: MessagePart[];
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

    // Validate the chat ID
    if (!id) {
      console.error("Missing chat ID in request");
      return new Response("Chat ID is required", { status: 400 });
    }

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
    const slackTool = toolRegistry.getTool("slack");

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
          return await crmDealsTool.execute(userId, { dealId: id });
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
      // Add Slack messaging tool
      sendSlackMessage: {
        description: "Send a message to a Slack channel",
        parameters: z.object({
          channelName: z
            .string()
            .describe("Slack channel name (e.g., '#general')"),
          message: z.string().describe("Message content to send"),
        }),
        execute: async (data: any) => {
          try {
            if (!slackTool) {
              return {
                success: false,
                error: "Slack tool not available",
                message:
                  "Unable to send Slack messages. Please connect your Slack account.",
                ui: {
                  type: "connection_required",
                  service: "slack",
                  message: "Please connect your Slack account to send messages",
                  connectButton: {
                    text: "Connect Slack",
                    action: "connection://slack",
                  },
                },
              };
            }

            return await slackTool.execute(userId, {
              action: "send_message",
              channelName: data.channelName,
              message: data.message,
            });
          } catch (error) {
            console.error("Error sending Slack message:", error);
            return {
              success: false,
              error:
                error instanceof Error
                  ? error.message
                  : "Unknown error sending Slack message",
              message:
                "There was an error sending your Slack message. Please try again later.",
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

    // Check and increment usage before processing the message
    try {
      await incrementUserUsage(userId);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "Monthly usage limit exceeded"
      ) {
        return Response.json(
          { error: "Monthly usage limit exceeded" },
          { status: 429 }
        );
      }
      throw error;
    }

    // Return a streaming response
    return createDataStreamResponse({
      execute: (dataStream) => {
        // Create a wrapper for the dataStream with proper append method
        const streamAdapter = createStreamAdapter(dataStream);

        // Add debug logging for stream adapter
        console.log("Stream adapter created:", {
          hasAppend: typeof streamAdapter.append === "function",
          hasClose: typeof streamAdapter.close === "function",
        });

        // Initialize the document tool with the proper stream adapter
        toolsObject.createDocument = createDocument({
          session: userSession,
          dataStream: streamAdapter,
        });

        // Explicitly get the system prompt and check its type
        let systemPromptString: string | undefined;
        const promptResult = systemPrompt({ selectedChatModel });
        if (typeof promptResult === "string") {
          systemPromptString = promptResult || undefined;
        } else {
          console.warn(
            "System prompt function did not return a string as expected. Using undefined prompt."
          );
          systemPromptString = undefined;
        }

        const result = streamText({
          model: myProvider.languageModel(selectedChatModel),
          system: systemPromptString,
          messages: (messages as ChatMessage[]).map((msg) => {
            // Ensure content is a string
            let content = "";
            if (typeof msg.content === "string") {
              content = msg.content;
            } else if (Array.isArray(msg.content)) {
              content = msg.content
                .map((part: MessagePart) =>
                  typeof part === "string"
                    ? part
                    : part.text || JSON.stringify(part)
                )
                .join(" ");
            } else if (msg.content) {
              content = JSON.stringify(msg.content);
            }

            // Create a properly formatted message based on role
            const baseMessage: Partial<CoreMessage> = {
              content: content,
              ...(msg.parts && {
                parts: msg.parts.map((part) => {
                  if (typeof part === "string") {
                    return { type: "text", text: part };
                  }
                  if (typeof part === "object" && part !== null) {
                    // Handle tool activity messages
                    if (part.type === "toolActivity") {
                      return {
                        type: "toolActivity",
                        text: part.text || part.content || JSON.stringify(part),
                      };
                    }
                    // Handle standard text messages
                    if ("type" in part && "text" in part) {
                      return { type: part.type, text: part.text };
                    }
                    // Handle other message types
                    return {
                      type: "text",
                      text: JSON.stringify(part),
                    };
                  }
                  return { type: "text", text: String(part) };
                }),
              }),
            };

            // Return the appropriate message type based on role
            switch (msg.role) {
              case "system":
                return {
                  ...baseMessage,
                  role: "system" as const,
                } as CoreMessage;
              case "user":
                return { ...baseMessage, role: "user" as const } as CoreMessage;
              case "assistant":
                return {
                  ...baseMessage,
                  role: "assistant" as const,
                } as CoreMessage;
              default:
                return { ...baseMessage, role: "user" as const } as CoreMessage;
            }
          }),
          maxSteps: 5,
          experimental_transform: smoothStream({ chunking: "word" }),
          experimental_generateMessageId: generateUUID,
          tools: toolsObject,
          onFinish: async ({ response }) => {
            console.log("Stream finished, saving response...");
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

                // Ensure assistantMessage content is correctly formatted for saving
                // The database expects parts to be an array of objects, e.g., { type: 'text', text: '...' }
                let messageParts: any[] = [];
                if (typeof assistantMessage.content === "string") {
                  // If content is a simple string, wrap it in the standard part structure
                  messageParts = [
                    { type: "text", text: assistantMessage.content },
                  ];
                } else if (Array.isArray(assistantMessage.content)) {
                  // If content is already an array of parts, use it directly
                  // Ensure the parts conform to the expected structure if necessary
                  messageParts = assistantMessage.content.map((part) => {
                    if (part.type === "text") {
                      return { type: "text", text: part.text };
                    } else {
                      // Handle other part types if necessary, or stringify them
                      console.warn(
                        "Unhandled part type in assistant message content:",
                        part.type
                      );
                      return { type: part.type, content: part }; // Or adjust as needed for DB schema
                    }
                  });
                } else {
                  // Handle cases where content might be missing or in an unexpected format
                  console.warn(
                    "Assistant message content has unexpected format or is missing:",
                    assistantMessage.content
                  );
                  messageParts = [
                    { type: "text", text: "[AI response content unavailable]" },
                  ];
                }

                // Save the assistant message with its structured content
                await saveMessages({
                  messages: [
                    {
                      id: assistantId,
                      chatId: id,
                      role: "assistant",
                      // Use the processed parts derived from assistantMessage.content
                      parts: messageParts,
                      // Preserve original attachments if they exist (using type assertion)
                      attachments:
                        (assistantMessage as any).experimental_attachments ??
                        [],
                      // Preserve original metadata if it exists (using type assertion)
                      metadata: (assistantMessage as any).metadata ?? {},
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

        // Add debug logging for stream consumption
        console.log("Starting stream consumption...");
        result.consumeStream();
        result.mergeIntoDataStream(dataStream, {
          sendReasoning: true,
        });
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
      // Check for connection_required UI type
      if (response?.output?.ui?.type === "connection_required") {
        return response.output.ui;
      }

      // Check for error responses that might indicate insufficient permissions
      if (
        response?.output?.status === "error" &&
        (response?.output?.error?.includes("Insufficient Permission") ||
          response?.output?.error?.includes("403"))
      ) {
        // Extract the provider from the tool name or error message
        let provider = "unknown";
        if (response?.output?.name) {
          if (response.output.name.includes("google-meet"))
            provider = "google-meet";
          else if (response.output.name.includes("calendar"))
            provider = "google-calendar";
          else if (response.output.name.includes("docs"))
            provider = "google-docs";
          else if (response.output.name.includes("slack")) provider = "slack";
        }

        // Create a connection UI object
        return {
          type: "connection_required",
          service: provider,
          message: `You need additional permissions for ${provider}. Please reconnect with the required scopes.`,
          requiredScopes: response?.output?.ui?.requiredScopes || [],
          connectButton: {
            text: `Reconnect ${
              provider === "google-calendar"
                ? "Google Calendar"
                : provider === "google-meet"
                ? "Google Meet"
                : provider === "google-docs"
                ? "Google Docs"
                : provider === "slack"
                ? "Slack"
                : provider
            }`,
            action: `connection://${provider}`,
          },
        };
      }
    }

    // Also check if the message content contains any connection text markers
    if (message.content && typeof message.content === "string") {
      const connectionRegex =
        /connect your (Google Meet|Google Calendar|CRM|Slack) account/i;
      const match = message.content.match(connectionRegex);

      if (match) {
        // Determine the service type from the content
        let service = "unknown";
        if (match[1].toLowerCase().includes("meet")) service = "google-meet";
        else if (match[1].toLowerCase().includes("calendar"))
          service = "google-calendar";
        else if (match[1].toLowerCase().includes("crm")) service = "crm";
        else if (match[1].toLowerCase().includes("slack")) service = "slack";

        // Return a generic connection UI object
        return {
          type: "connection_required",
          service,
          message: `Please connect your ${match[1]} account to continue`,
          connectButton: {
            text: `Connect ${
              service === "google-calendar"
                ? "Google Calendar"
                : service === "google-meet"
                ? "Google Meet"
                : service === "slack"
                ? "Slack"
                : service
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
