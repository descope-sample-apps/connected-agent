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
import { getMostRecentUserMessage } from "@/lib/utils";
import { myProvider } from "@/lib/ai/providers";
import { getCRMToken } from "@/lib/descope";
import { parseRelativeDate, getCurrentDateContext } from "@/lib/date-utils";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { nanoid } from "nanoid";
import { z } from "zod";
import { CRMDealsTool } from "@/lib/tools/crm";
import { toolRegistry } from "@/lib/tools/base";
import { CalendarTool } from "@/lib/tools/calendar";
import { CalendarListTool } from "@/lib/tools/calendar-list";
import { searchContact } from "@/lib/api/crm-utils";
import { format, addDays, addWeeks } from "date-fns";

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
          // Handle step markers (like step-end)
          else if (
            "type" in data &&
            (data.type === "step-end" ||
              (typeof data.type === "string" && data.type.startsWith("step")))
          ) {
            formattedData = {
              type: "text",
              text: "Done",
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

        // Additional check to catch any raw step-end JSON that might have slipped through
        if (outputData.includes('"type":"step-end"')) {
          outputData = JSON.stringify({
            type: "text",
            text: "Done",
          });
        }

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
            const vagueTerms = [
              "later",
              "sometime",
              "soon",
              "when",
              "eventually",
              "flexible",
            ];

            // Don't allow completely vague date terms
            if (
              vagueTerms.some((term) => lowerDateString.includes(term)) ||
              (lowerDateString === "today" && !timeString)
            ) {
              console.log("Date string is too vague:", lowerDateString);
              return {
                success: false,
                needsMoreDetails: true,
                error: "Date specification is too vague",
                message: `I need a more specific date than "${dateString}". Today is ${format(
                  new Date(),
                  "MMMM d, yyyy"
                )}. Could you provide a specific date or day of the week?`,
                dateContext: getCurrentDateContext(),
                originalInput: { dateString, timeString },
              };
            }

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
              // Import the createConnectionRequest function
              const { createConnectionRequest } = await import(
                "@/lib/tools/base"
              );

              // Use the standardized connection request function
              return createConnectionRequest({
                provider: "custom-crm",
                customMessage: "CRM access is required to view contacts.",
                toolId: "crm-contacts",
                operation: "contacts.list",
              });
            }

            // If only a name is provided, let's first search for the contact
            if (name && !email && !id) {
              console.log(
                "[getCRMContacts] Searching for contact by name:",
                name
              );

              // Get CRM access token
              const tokenResponse = await getCRMToken(userId, "tool_calling");
              console.log("[getCRMContacts] Token response:", {
                hasToken: tokenResponse && "token" in tokenResponse,
                hasError: tokenResponse && "error" in tokenResponse,
                error:
                  tokenResponse && "error" in tokenResponse
                    ? tokenResponse.error
                    : null,
              });

              // Handle connection required responses directly
              if (
                !tokenResponse ||
                ("error" in tokenResponse &&
                  tokenResponse.error === "connection_required")
              ) {
                // Only use scopes if they come from the token response
                const requiredScopes =
                  tokenResponse &&
                  "requiredScopes" in tokenResponse &&
                  Array.isArray(tokenResponse.requiredScopes) &&
                  tokenResponse.requiredScopes.length > 0
                    ? tokenResponse.requiredScopes
                    : undefined;

                console.log(
                  "[getCRMContacts] Connection required - returning UI prompt with scopes:",
                  requiredScopes || "none (letting Descope handle defaults)"
                );

                // Import the createConnectionRequest function
                const { createConnectionRequest } = await import(
                  "@/lib/tools/base"
                );

                // Use the standardized connection request function
                return createConnectionRequest({
                  provider: "custom-crm",
                  isReconnect: false,
                  requiredScopes,
                  customMessage: "CRM access is required to view contacts.",
                  toolId: "crm-contacts",
                  operation: "contacts.list",
                });
              }

              // If we have insufficient scopes, handle that specifically
              if (
                tokenResponse &&
                "error" in tokenResponse &&
                tokenResponse.error === "insufficient_scopes"
              ) {
                console.log(
                  "[getCRMContacts] Insufficient scopes - returning reconnect prompt"
                );

                // Import the createConnectionRequest function
                const { createConnectionRequest } = await import(
                  "@/lib/tools/base"
                );

                // Use the standardized connection request function
                return createConnectionRequest({
                  provider: "custom-crm",
                  isReconnect: true,
                  requiredScopes: tokenResponse.requiredScopes,
                  currentScopes: tokenResponse.currentScopes,
                  customMessage:
                    "Additional CRM permissions are required to look up contacts.",
                  toolId: "crm-contacts",
                  operation: "contacts.list",
                });
              }

              // Use type guard to safely access token
              if (
                tokenResponse &&
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
                console.log(
                  "[getCRMContacts] Unknown token error - returning generic connection error"
                );
                // Import the createConnectionRequest function
                const { createConnectionRequest } = await import(
                  "@/lib/tools/base"
                );

                // Use the standardized connection request function
                return createConnectionRequest({
                  provider: "custom-crm",
                  customMessage:
                    "Unable to authenticate with the CRM service. Please reconnect your CRM.",
                  toolId: "crm-contacts",
                  operation: "contacts.list",
                });
              }
            }

            // If we have an email or ID, use the regular tool execution
            // Search by whatever parameter was provided
            console.log(
              "[getCRMContacts] Using crmContactsTool.execute with:",
              { name, email, id }
            );
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

            // Validate the start time - must be in the future and not more than 1 year ahead
            try {
              const startTimeDate = new Date(data.startTime);
              const now = new Date();
              const oneYearFromNow = new Date();
              oneYearFromNow.setFullYear(now.getFullYear() + 1);

              // Check if event date is before now (in the past)
              if (startTimeDate < now) {
                console.warn("Calendar event startTime is in the past:", {
                  startTime: data.startTime,
                  currentTime: now.toISOString(),
                });

                // Assume this is an error - if the user said "tomorrow" but date is in the past,
                // they probably meant tomorrow from today
                if (
                  data.originalStartTime &&
                  data.originalStartTime.toLowerCase().includes("tomorrow")
                ) {
                  console.log(
                    "Fixing 'tomorrow' date that was parsed incorrectly"
                  );
                  const tomorrow = new Date();
                  tomorrow.setDate(tomorrow.getDate() + 1);

                  // Keep the time portion from the original date but use tomorrow's date
                  tomorrow.setHours(startTimeDate.getHours());
                  tomorrow.setMinutes(startTimeDate.getMinutes());

                  data.startTime = tomorrow.toISOString();
                  console.log("Fixed startTime to:", data.startTime);

                  // Adjust endTime too if it exists
                  if (data.endTime) {
                    const endTimeDate = new Date(data.endTime);
                    const timeDiff =
                      endTimeDate.getTime() - startTimeDate.getTime();
                    const newEndTime = new Date(tomorrow.getTime() + timeDiff);
                    data.endTime = newEndTime.toISOString();
                    console.log("Adjusted endTime to:", data.endTime);
                  }
                }
              }

              // Check if date is more than a year in the future
              if (startTimeDate > oneYearFromNow) {
                console.warn(
                  "Calendar event startTime is more than a year ahead:",
                  {
                    startTime: data.startTime,
                    oneYearFromNow: oneYearFromNow.toISOString(),
                  }
                );
              }
            } catch (e) {
              console.error("Error validating calendar date:", e);
            }

            // Execute the calendar tool
            console.log("Executing calendar tool with data:", {
              title: data.title,
              startTime: data.startTime,
              endTime: data.endTime,
              attendees: data.attendees?.length || 0,
              originalInput: data,
            });

            // Check if startTime looks like a relative date that needs to be processed
            if (
              typeof data.startTime === "string" &&
              (data.startTime.toLowerCase().includes("tomorrow") ||
                data.startTime.toLowerCase().includes("next") ||
                data.startTime.toLowerCase().includes("monday") ||
                data.startTime.toLowerCase().includes("tuesday") ||
                data.startTime.toLowerCase().includes("wednesday") ||
                data.startTime.toLowerCase().includes("thursday") ||
                data.startTime.toLowerCase().includes("friday") ||
                data.startTime.toLowerCase().includes("saturday") ||
                data.startTime.toLowerCase().includes("sunday"))
            ) {
              console.log(
                "Detected relative date in startTime:",
                data.startTime
              );
              console.log("Current server date:", new Date().toISOString());

              // Parse the relative date using the current date as base
              const nowDate = new Date();
              let dateString, timeString;

              // Split into date and time parts if needed
              if (data.startTime.includes(" at ")) {
                [dateString, timeString] = data.startTime.split(" at ");
              } else {
                dateString = data.startTime;
                timeString = "12:00";
              }

              console.log("Parsing relative date with:", {
                dateString,
                timeString,
                baseDate: nowDate,
              });
              const parsedDate = parseRelativeDate(
                dateString,
                timeString,
                nowDate,
                timezone
              );

              // Save the original startTime for reference
              data.originalStartTime = data.startTime;

              // Update the startTime with the parsed ISO date
              data.startTime = parsedDate.date.toISOString();
              console.log("Updated startTime to:", data.startTime);

              // If endTime is not specified, default to 1 hour after start
              if (!data.endTime) {
                const endDate = new Date(parsedDate.date);
                endDate.setHours(endDate.getHours() + 1);
                data.endTime = endDate.toISOString();
                console.log("Set default endTime to:", data.endTime);
              }
            }

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

      // For other errors, return a generic error response
      console.error("Error checking user usage:", error);
      return Response.json(
        {
          error:
            error instanceof Error ? error.message : "Error checking usage",
          message:
            "There was an error processing your request. Please try again.",
        },
        { status: 500 }
      );
    }

    // Get system prompt with date context added
    const baseSystemPrompt = systemPrompt({ selectedChatModel });
    const currentDate = new Date();
    const enhancedSystemPrompt = `${baseSystemPrompt}

Today's date is ${currentDate.toDateString()} (${currentDate.toISOString()}).
When handling date and time references:
- Ask for clarification if the user provides vague time references
- Confirm specific dates and times before scheduling
- Interpret relative terms (tomorrow, next week) relative to today's date

IMPORTANT: SERVICES CONNECTION HANDLING
When you need to access a service that requires connection or authentication:
1. DO NOT mention reconnecting multiple times or repeat yourself
2. Instead, ALWAYS use the appropriate tool (getCRMContacts, createCalendarEvent, etc.) which will automatically handle connection requirements
3. NEVER say phrases like "I need to reconnect" or "Let me reconnect" - the system will show the proper UI
4. If a tool returns an error indicating connection is required, simply state ONCE that you need the service connected
5. For CRM contacts specifically, always use the getCRMContacts tool - do not explain that CRM access is needed

Example response when CRM service is not connected:
"To provide John Doe's contact information, I'll need to check the CRM system."
Then use the getCRMContacts tool, which will handle showing the connection UI.
`;

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

        const result = streamText({
          model: myProvider.languageModel(selectedChatModel),
          system: enhancedSystemPrompt,
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
                const assistantMessage = assistantMessages[
                  assistantMessages.length - 1
                ] as any; // Cast to any to allow attaching ui property
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
                  messageParts = assistantMessage.content.map((part: any) => {
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

                // Extract UI elements if present
                const uiElements =
                  extractUIElementsFromToolResponses(assistantMessage);
                if (uiElements) {
                  console.log(
                    "[onFinish] Found UI elements to add to messageParts:",
                    {
                      type: uiElements.type,
                      service: uiElements.service,
                      hasConnectButton: !!uiElements.connectButton,
                      hasRequiredScopes: !!uiElements.requiredScopes,
                      requiredScopesCount:
                        uiElements.requiredScopes?.length || 0,
                    }
                  );
                  messageParts.push({
                    type: "connection",
                    connection: uiElements,
                  });

                  // Also add the UI element directly to the message object for easier detection
                  assistantMessage.ui = uiElements;

                  console.log(
                    "[onFinish] Added connection UI element to messageParts:",
                    uiElements.requiredScopes
                      ? `with ${uiElements.requiredScopes.length} scopes`
                      : "without scopes (using Descope defaults)"
                  );
                }
                // If no UI elements were explicitly found but the message appears to be a connection request
                else if (isConnectionRequestResponse(assistantMessage)) {
                  console.log(
                    "[onFinish] Message appears to be a connection request but no UI element was found"
                  );

                  // Determine the service from message content
                  const content =
                    typeof assistantMessage.content === "string"
                      ? assistantMessage.content.toLowerCase()
                      : "";

                  let service: string = "custom-crm"; // Default to CRM
                  if (content.includes("calendar")) service = "google-calendar";
                  else if (content.includes("slack")) service = "slack";
                  else if (content.includes("zoom")) service = "zoom";
                  else if (content.includes("meet")) service = "google-meet";
                  else if (
                    content.includes("docs") ||
                    content.includes("drive")
                  )
                    service = "google-docs";

                  // Create a synthetic UI element
                  const syntheticUIElement = {
                    type: "connection_required",
                    service: service,
                    message: `Please connect your ${service
                      .replace("custom-", "")
                      .replace("-", " ")} to continue.`,
                    connectButton: {
                      text: `Connect ${service
                        .replace("custom-", "")
                        .replace("-", " ")}`,
                      action: `connection://${service}`,
                    },
                    alternativeMessage:
                      "This will allow the assistant to access the necessary data.",
                  };

                  console.log(
                    "[onFinish] Created synthetic UI element:",
                    syntheticUIElement
                  );

                  // Add to message parts
                  messageParts.push({
                    type: "connection",
                    connection: syntheticUIElement,
                  });

                  // Also add directly to the message object for easier detection
                  assistantMessage.ui = syntheticUIElement;

                  console.log(
                    "[onFinish] Added synthetic connection UI element to messageParts"
                  );
                }

                // Log the final messageParts structure before saving
                console.log("[onFinish] Saving message with parts:", {
                  partTypes: messageParts.map((part) => part.type),
                  hasConnectionPart: messageParts.some(
                    (part) => part.type === "connection"
                  ),
                  messagePartsCount: messageParts.length,
                });

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

        // Check if this is a monthly usage limit error or other expected error
        if (error instanceof Error) {
          // Format the error as a structured JSON response
          const errorResponse = {
            error: error.name || "Error",
            message:
              error.message ||
              "Sorry, there was an error processing your request. Please try again.",
          };

          // Return formatted error response string
          return JSON.stringify(errorResponse);
        }

        // Default error message
        return JSON.stringify({
          error: "ChatProcessingError",
          message:
            "An error occurred while processing your request. Please try again.",
        });
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
    console.log("[extractUIElementsFromToolResponses] Processing message:", {
      hasToolResponses: !!message.tool_responses,
      toolResponsesCount: message.tool_responses?.length || 0,
      hasToolActions: !!message.toolActions,
      toolActionsCount: message.toolActions?.length || 0,
    });

    // Check if the message contains direct UI information
    if (message.ui && message.ui.type === "connection_required") {
      console.log(
        "[extractUIElementsFromToolResponses] Found direct UI connection element"
      );
      return message.ui;
    }

    // Check if the message contains tool responses
    const toolResponses = message.tool_responses || [];

    // Look for connection_required UI elements in any tool response
    for (const response of toolResponses) {
      console.log(
        "[extractUIElementsFromToolResponses] Checking tool response:",
        {
          hasOutput: !!response?.output,
          hasUI: !!response?.output?.ui,
          uiType: response?.output?.ui?.type,
        }
      );

      if (response?.output?.ui?.type === "connection_required") {
        console.log(
          "[extractUIElementsFromToolResponses] Found connection_required UI in tool response"
        );
        return response.output.ui;
      }
    }

    // ALSO check toolActions array where CRM tools might be storing their output
    if (message.toolActions && Array.isArray(message.toolActions)) {
      for (const action of message.toolActions) {
        console.log(
          "[extractUIElementsFromToolResponses] Checking tool action:",
          {
            hasOutput: !!action?.output,
            hasUI: !!action?.output?.ui,
            uiType: action?.output?.ui?.type,
          }
        );

        if (action?.output?.ui?.type === "connection_required") {
          console.log(
            "[extractUIElementsFromToolResponses] Found connection_required UI in tool action"
          );
          return action.output.ui;
        }
      }
    }

    // Check if a toolResponse property exists with UI element
    if (
      message.toolResponse &&
      message.toolResponse.ui &&
      message.toolResponse.ui.type === "connection_required"
    ) {
      console.log(
        "[extractUIElementsFromToolResponses] Found connection_required UI in toolResponse"
      );
      return message.toolResponse.ui;
    }

    // If no UI element found in tool responses, return null
    return null;
  } catch (error) {
    console.error("Error extracting UI elements:", error);
    return null;
  }
}

// Helper function to determine if a message needs to have a connection request attached
function isConnectionRequestResponse(message: any): boolean {
  // Check for common connection request patterns in the message content
  if (typeof message.content === "string") {
    const content = message.content.toLowerCase();

    if (
      (content.includes("connect") &&
        (content.includes("crm") ||
          content.includes("custom-crm") ||
          content.includes("calendar") ||
          content.includes("slack"))) ||
      content.includes("connection required") ||
      content.includes("permissions required") ||
      content.includes("authorization") ||
      content.includes("oauth")
    ) {
      console.log(
        "[isConnectionRequestResponse] Detected connection request in message content"
      );
      return true;
    }
  }

  // Check if any tool response has a connection UI
  if (message.tool_responses && Array.isArray(message.tool_responses)) {
    for (const response of message.tool_responses) {
      if (response?.output?.ui?.type === "connection_required") {
        console.log(
          "[isConnectionRequestResponse] Found connection UI in tool response"
        );
        return true;
      }
    }
  }

  // Check for connection UI in toolActions
  if (message.toolActions && Array.isArray(message.toolActions)) {
    for (const action of message.toolActions) {
      if (action?.output?.ui?.type === "connection_required") {
        console.log(
          "[isConnectionRequestResponse] Found connection UI in tool action"
        );
        return true;
      }
    }
  }

  // No connection request patterns found
  return false;
}
