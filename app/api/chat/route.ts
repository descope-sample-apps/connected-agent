// Import API initialization to ensure all tools are registered
import "@/app/api/_init";

import {
  UIMessage,
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
  incrementUserUsage,
} from "@/lib/db/queries";
import {
  generateUUID,
  getMostRecentUserMessage,
  getTrailingMessageId,
  isCrmRelatedQuery,
} from "@/lib/utils";
import { createDocumentWrapper } from "@/lib/tools/documents";
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
import { format, addDays, addWeeks } from "date-fns";

// Add this interface definition
interface DataStreamWithAppend {
  append: (data: any) => void;
  close?: () => void;
}

// Simple interface for stream handling
interface BaseStream {
  write?: (data: string) => void;
  append?: (data: any) => void;
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
  // If dataStream already has an append method, return it
  if (dataStream && typeof dataStream.append === "function") {
    return dataStream;
  }

  // Create a simple wrapper with append method
  return {
    append: (data: any) => {
      try {
        // Format the data if needed
        let formattedData = data;

        // Special handling for connection requirement markers
        if (data && typeof data === "object") {
          // Handle tool activities
          if ("toolActivity" in data) {
            if (
              data.toolActivity &&
              data.toolActivity.step === "connection_required"
            ) {
              // Special case for connection requirements - use simple text format
              formattedData = {
                type: "text",
                text: `Connection to ${
                  data.toolActivity.service || "Google Docs"
                } required. Please connect to continue.`,
              };
            } else {
              // Normal tool activity
              formattedData = {
                type: "toolActivity",
                text:
                  data.toolActivity.text || JSON.stringify(data.toolActivity),
              };
            }
          }
          // Handle step markers (like step-start)
          else if (
            "type" in data &&
            (data.type === "step-start" ||
              data.type === "step-end" ||
              (typeof data.type === "string" && data.type.startsWith("step")))
          ) {
            formattedData = {
              type: "text",
              text: `${data.type === "step-start" ? "Thinking..." : "Done"}`,
            };
          }
          // Handle connection_required UI elements - use simple text
          else if (data.ui && data.ui.type === "connection_required") {
            formattedData = {
              type: "text",
              text: `Connection to ${data.ui.service || "service"} required. ${
                data.ui.message || "Please connect to continue."
              }`,
            };
          }
          // Handle direct connection error objects that might come from Google Docs tool
          else if (
            "error" in data &&
            typeof data.error === "string" &&
            (data.error.includes("connection") ||
              data.error.includes("Google Docs")) &&
            "provider" in data
          ) {
            formattedData = {
              type: "text",
              text: `Connection to ${data.provider || "service"} required. ${
                data.customMessage || "Please connect to continue."
              }`,
            };
          }
        }

        // Ensure we're sending a valid JSON string followed by a newline
        let outputData =
          typeof formattedData === "string"
            ? formattedData
            : JSON.stringify(formattedData);

        // Add proper newline to ensure stream boundaries are clear
        if (!outputData.endsWith("\n")) {
          outputData += "\n";
        }

        // If dataStream has a write method, use that instead
        if (dataStream && typeof dataStream.write === "function") {
          dataStream.write(outputData);
        } else {
          console.warn("dataStream does not have append or write method");
        }
      } catch (error) {
        console.error("Error appending to stream:", error);
        // If there's an error, try to send a simplified error message
        if (dataStream && typeof dataStream.write === "function") {
          dataStream.write(
            JSON.stringify({
              type: "text",
              text: "Error processing response",
            }) + "\n"
          );
        }
      }
    },
    write: (data: string) => {
      try {
        if (dataStream && typeof dataStream.write === "function") {
          dataStream.write(data);
        }
      } catch (error) {
        console.error("Error writing to stream:", error);
      }
    },
    close: () => {
      try {
        if (dataStream && typeof dataStream.close === "function") {
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

interface ParsedDate {
  date: Date;
  formatted: string;
  time: string;
}

export async function POST(request: Request) {
  try {
    const {
      id,
      messages,
      selectedChatModel = DEFAULT_CHAT_MODEL,
      timezone = "UTC",
      timezoneOffset = 0,
    }: {
      id: string;
      messages: Array<UIMessage>;
      selectedChatModel?: string;
      timezone?: string;
      timezoneOffset?: number;
    } = await request.json();

    // Validate the chat ID
    if (!id) {
      console.error("Missing chat ID in request");
      return new Response("Chat ID is required", { status: 400 });
    }

    // Log timezone information for debugging
    console.log(`Request timezone: ${timezone} (offset: ${timezoneOffset})`);

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

    // Only save the user message if it's a new one (not loaded from history)
    // Check if this message has a unique client-generated ID and isn't already saved
    if (userMessage.id && !userMessage.id.startsWith("db-")) {
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
    }

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
            console.log(
              `Parsing date: "${dateString}" at time: "${timeString}" with timezone: ${timezone}`
            );

            // Check if the date string is too vague
            const lowerDateString = dateString.toLowerCase().trim();

            // If just "next week" without a specific day, we need more details
            if (lowerDateString === "next week") {
              console.log(
                "Date string 'next week' is too vague, requesting more details"
              );
              return {
                success: false,
                needsMoreDetails: true,
                error: "Date specification is too vague",
                message:
                  "Could you specify which day next week? For example, 'next Monday' or 'next Wednesday at 2pm'.",
                dateContext: getCurrentDateContext(),
                originalInput: { dateString, timeString },
              };
            }

            // For other vague terms that need time specification
            const vagueTimeTerms = ["morning", "afternoon", "evening", "night"];
            if (
              !timeString ||
              timeString === "12:00" ||
              vagueTimeTerms.includes(timeString.toLowerCase().trim())
            ) {
              // If specific day but no specific time and it's not a vagueTimeTerm
              if (
                (lowerDateString.includes("monday") ||
                  lowerDateString.includes("tuesday") ||
                  lowerDateString.includes("wednesday") ||
                  lowerDateString.includes("thursday") ||
                  lowerDateString.includes("friday") ||
                  lowerDateString.includes("saturday") ||
                  lowerDateString.includes("sunday")) &&
                !vagueTimeTerms.includes(timeString?.toLowerCase().trim() || "")
              ) {
                console.log(
                  "Date has specific day but needs time clarification"
                );
                return {
                  success: false,
                  needsMoreDetails: true,
                  error: "Time specification needed",
                  message: `What time on ${dateString} would you like to schedule this for?`,
                  dateContext: getCurrentDateContext(),
                  originalInput: { dateString, timeString },
                };
              }
            }

            // Always use a fresh current date
            const now = new Date();
            console.log(`Current timestamp: ${now.toISOString()}`);

            // Apply timezone offset to the date for more accurate calculations
            if (timezoneOffset !== 0) {
              // Convert the offset from minutes to milliseconds
              const offsetMs = timezoneOffset * 60 * 1000;
              // Adjust the date by adding the offset
              now.setTime(now.getTime() + offsetMs);
              console.log(
                `Adjusted timestamp for timezone offset: ${now.toISOString()}`
              );
            }

            // Get date context with fresh date
            const dateContext = {
              currentDate: format(now, "MMMM d, yyyy"),
              currentTime: format(now, "h:mm a"),
              tomorrow: format(addDays(now, 1), "MMMM d, yyyy"),
              nextWeek: format(addWeeks(now, 1), "MMMM d, yyyy"),
              timezone: timezone,
              timezoneOffset: timezoneOffset,
            };

            // Pass the fresh date explicitly to ensure no cached dates are used
            const parsedDate = parseRelativeDate(dateString, timeString, now);

            console.log("Parsed date result:", {
              date: parsedDate.date.toISOString(),
              formattedDate: parsedDate.formattedDate,
              formattedTime: parsedDate.formattedTime,
              inputString: dateString,
              timezone: timezone,
            });

            // Format the date for calendar event creation
            const formattedDate = {
              iso: parsedDate.date.toISOString(),
              display: parsedDate.formattedDate,
              time: parsedDate.formattedTime,
              date: parsedDate.date,
              timezone: timezone,
            };

            return {
              success: true,
              dateContext,
              parsedDate: formattedDate,
              instructions:
                "Use the 'iso' field when creating calendar events to ensure proper date formatting.",
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
            .describe("Time zone (optional, defaults to user's timezone)"),
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

            // Use the client's timezone if no timeZone was specified
            if (!data.timeZone && timezone !== "UTC") {
              data.timeZone = timezone;
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
            .describe("Time zone (optional, defaults to user's timezone)"),
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

            // Use the client's timezone if no timeZone was specified
            if (!data.timeZone && timezone !== "UTC") {
              console.log(
                `Using client timezone for calendar event: ${timezone}`
              );
              data.timeZone = timezone;
            }

            // Execute the calendar tool
            console.log("Executing calendar tool with data:", {
              title: data.title,
              startTime: data.startTime,
              endTime: data.endTime,
              attendees: data.attendees?.length || 0,
            });

            const calendarResult = await calendarTool.execute(userId, data);

            // If successful, enhance the response with formatted content
            if (calendarResult.success && calendarResult.data) {
              console.log("Calendar event created successfully:", {
                eventId: calendarResult.data.calendarEventId,
                eventLink: calendarResult.data.calendarEventLink,
              });

              // If the tool returned a formatted message, use it
              if (calendarResult.data.formattedMessage) {
                return {
                  ...calendarResult,
                  message: calendarResult.data.formattedMessage,
                };
              }

              // Otherwise, create our own formatted response
              const startDate = new Date(calendarResult.data.startTime);
              const formattedStartDate = format(
                startDate,
                "MMMM d, yyyy 'at' h:mm a"
              );

              return {
                ...calendarResult,
                message: `Calendar event "${calendarResult.data.title}" created successfully for ${formattedStartDate}. [View in Google Calendar](${calendarResult.data.calendarEventLink})`,
              };
            }

            return calendarResult;
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
          {
            error: "Monthly usage limit exceeded",
            message:
              "You've reached your monthly usage limit for this service. Please check your subscription or try again next month.",
          },
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

        // Initialize the document tool with the proper stream adapter using our wrapper function
        toolsObject.createDocument = {
          description: "Create a Google Doc document",
          parameters: z.object({
            title: z.string().describe("Document title"),
            content: z.string().describe("Document content"),
          }),
          execute: async ({
            title,
            content,
          }: {
            title: string;
            content: string;
          }) => {
            try {
              if (!userSession?.token?.sub) {
                return {
                  success: false,
                  error: "User not authenticated",
                  message: "You need to be signed in to create documents.",
                };
              }

              // Import the documentsTool directly to avoid circular dependencies
              const { documentsTool } = await import("@/lib/tools/documents");

              // Use the documentsTool directly
              return await documentsTool.execute(userSession.token.sub, {
                title,
                content,
              });
            } catch (error) {
              return {
                success: false,
                error:
                  error instanceof Error
                    ? error.message
                    : "Failed to create document",
                message:
                  "There was an error creating your document. Please try again.",
              };
            }
          },
        };

        // Get system prompt
        const promptResult = systemPrompt({ selectedChatModel });
        const systemPromptString =
          typeof promptResult === "string" ? promptResult : undefined;

        const result = streamText({
          model: myProvider.languageModel(selectedChatModel),
          system: systemPromptString,
          messages: (messages as any[]).map((msg) => {
            // Ensure content is a string
            let content = "";
            if (typeof msg.content === "string") {
              content = msg.content;
            } else if (Array.isArray(msg.content)) {
              content = msg.content
                .map((part: any) => {
                  if (typeof part === "string") return part;
                  if (typeof part === "object" && part !== null) {
                    return part.text || JSON.stringify(part);
                  }
                  return String(part || "");
                })
                .join(" ");
            } else if (msg.content) {
              content = String(msg.content);
            }

            return {
              role: msg.role,
              content: content,
            };
          }),
          maxSteps: 5,
          experimental_transform: smoothStream({ chunking: "word" }),
          tools: toolsObject,
          onFinish: async ({ response }) => {
            console.log("Stream finished, saving response...");
            if (userId) {
              try {
                // Get the assistant messages
                const assistantMessages = response.messages.filter(
                  (message) => message.role === "assistant"
                );

                if (assistantMessages.length === 0) {
                  throw new Error("No assistant message found!");
                }

                // Find the last assistant message
                const assistantMessage =
                  assistantMessages[assistantMessages.length - 1];
                const assistantId = nanoid();

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
                    if (typeof part === "object" && part !== null) {
                      if (part.type === "text") {
                        return { type: "text", text: part.text || "" };
                      } else {
                        // For non-text parts, create a safe representation
                        return {
                          type: part.type || "unknown",
                          text: JSON.stringify(part),
                        };
                      }
                    } else if (typeof part === "string") {
                      return { type: "text", text: part };
                    } else {
                      return { type: "text", text: String(part || "") };
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

                // Check for connection requirements
                const messageText =
                  typeof assistantMessage.content === "string"
                    ? assistantMessage.content
                    : messageParts.map((part) => part.text || "").join(" ");

                // Extract UI elements if present
                const uiElements =
                  extractUIElementsFromToolResponses(assistantMessage);
                if (uiElements) {
                  messageParts.push({
                    type: "connection",
                    connection: uiElements,
                  });
                }

                // Save the assistant message with its structured content
                await saveMessages({
                  messages: [
                    {
                      id: assistantId,
                      chatId: id,
                      role: "assistant",
                      parts: messageParts,
                      attachments:
                        (assistantMessage as any).experimental_attachments ||
                        [],
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

        // Start stream consumption
        result.consumeStream();

        // Use the streamAdapter for merging
        try {
          // Use any to bypass type checking
          result.mergeIntoDataStream(dataStream, {
            sendReasoning: true,
          });
        } catch (error) {
          console.error("Error merging data stream:", error);
        }
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
      // More detailed regex to detect various connection patterns
      const connectionPatterns = [
        // Connect to service patterns
        /connect(?:\s+your|\s+to)?\s+(Google Meet|Google Calendar|Google Docs|CRM|Slack|Zoom)\s+(?:account|to continue)/i,
        // Additional permissions patterns
        /additional\s+permissions\s+(?:for|required\s+for)\s+(Google Meet|Google Calendar|Google Docs|CRM|Slack|Zoom)/i,
        // Need access patterns
        /need\s+(?:to\s+)?(?:connect|access)\s+(?:to\s+)?(Google Meet|Google Calendar|Google Docs|CRM|Slack|Zoom)/i,
      ];

      // Try each pattern to find a match
      let match = null;
      let matchedPattern = null;

      for (const pattern of connectionPatterns) {
        const result = message.content.match(pattern);
        if (result) {
          match = result;
          matchedPattern = pattern;
          break;
        }
      }

      if (match) {
        // Determine the service type from the content
        let service = "unknown";
        const serviceName = match[1].toLowerCase();

        if (serviceName.includes("meet")) service = "google-meet";
        else if (serviceName.includes("calendar")) service = "google-calendar";
        else if (serviceName.includes("docs")) service = "google-docs";
        else if (serviceName.includes("crm")) service = "custom-crm";
        else if (serviceName.includes("slack")) service = "slack";
        else if (serviceName.includes("zoom")) service = "zoom";

        // Determine if this is a reconnect request
        const isReconnect =
          matchedPattern?.source.includes("additional") ||
          message.content.toLowerCase().includes("additional permission") ||
          message.content.toLowerCase().includes("more permission");

        // Get appropriate display name
        const displayName =
          service === "google-calendar"
            ? "Google Calendar"
            : service === "google-docs"
            ? "Google Docs"
            : service === "google-meet"
            ? "Google Meet"
            : service === "custom-crm"
            ? "CRM"
            : service === "slack"
            ? "Slack"
            : service === "zoom"
            ? "Zoom"
            : service;

        // Build appropriate message
        const connectionMessage = isReconnect
          ? `Additional permissions are required for ${displayName}.`
          : `Please connect your ${displayName} account to continue.`;

        // Set default required scopes based on service
        let requiredScopes: string[] = [];
        if (service === "google-calendar") {
          requiredScopes = ["https://www.googleapis.com/auth/calendar"];
        } else if (service === "google-docs") {
          requiredScopes = ["https://www.googleapis.com/auth/documents"];
        } else if (service === "google-meet") {
          requiredScopes = [
            "https://www.googleapis.com/auth/meetings.space.created",
          ];
        }

        return {
          type: "connection_required",
          service,
          message: connectionMessage,
          connectButton: {
            text: isReconnect
              ? `Reconnect ${displayName}`
              : `Connect ${displayName}`,
            action: `connection://${service}`,
          },
          alternativeMessage:
            requiredScopes.length > 0
              ? `The following permissions are needed: ${requiredScopes
                  .map((s) => s.split("/").pop())
                  .join(", ")}`
              : "This will allow the assistant to access the necessary data to fulfill your request.",
          requiredScopes:
            requiredScopes.length > 0 ? requiredScopes : undefined,
        };
      }
    }

    return null;
  } catch (error) {
    console.error("Error extracting UI elements:", error);
    return null;
  }
}
