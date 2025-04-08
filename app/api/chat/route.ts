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
import {
  getGoogleCalendarToken,
  getCRMToken,
  getZoomToken,
} from "@/lib/descope";
import { parseRelativeDate, getCurrentDateContext } from "@/lib/date-utils";
import { isProductionEnvironment } from "@/lib/constants";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { nanoid } from "nanoid";
import { z } from "zod";
import { CRMDealsTool } from "@/lib/tools/crm";
import { toolRegistry } from "@/lib/tools/base";

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

// Add tool usage tracking to detect if tools aren't being used
const toolUsage = {
  calendar: false,
  zoom: false,
  contacts: false,
  deals: false,
  document: false,
};

// Wrap tool executions to track usage
const wrapToolWithTracking = (tool: any, toolName: string) => {
  const originalExecute = tool.execute;
  tool.execute = async (...args: any[]) => {
    console.log(`Tool ${toolName} called with args:`, args);
    toolUsage[toolName as keyof typeof toolUsage] = true;
    return originalExecute.apply(tool, args);
  };
  return tool;
};

// Add link detection and formatting for better display
function formatLinksForDisplay(content: string): string {
  // Check if the content has markdown links
  const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let formattedContent = content;

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
    // Get calendar tool if available
    const calendarTool = toolRegistry.getTool("calendar");
    // Get CRM contacts tool if available
    const crmContactsTool = toolRegistry.getTool("crm-contacts");

    // Debug tool registry to see what's available
    console.log("==== TOOL REGISTRY DEBUGGING ====");
    console.log(
      "Available tools in registry:",
      toolRegistry.getAllTools().map((t) => t.config.id)
    );
    console.log("Calendar tool found:", !!calendarTool);
    console.log(
      "Calendar tool details:",
      calendarTool ? calendarTool.config : "Not available"
    );
    console.log("================================");

    // CRITICAL FIX: Ensure the calendar implementation is ALWAYS available
    // If the tool registry doesn't provide it, we need to implement it directly
    let calendarImplementation: any;

    if (calendarTool) {
      console.log("Using registered calendar tool");
      calendarImplementation = calendarTool;
    } else {
      console.log(
        "WARNING: Calendar tool not found in registry. Creating direct implementation."
      );
      // Direct implementation to ensure we always have calendar functionality
      calendarImplementation = {
        execute: async (userId: string, data: any) => {
          try {
            console.log(
              "Executing direct calendar implementation with data:",
              data
            );

            // Get OAuth token for Google Calendar
            const calendarTokenResponse = await getGoogleCalendarToken(userId);

            if (!calendarTokenResponse || "error" in calendarTokenResponse) {
              console.log("Google Calendar connection required");
              return {
                success: false,
                error: "Google Calendar access required",
                ui: {
                  type: "connection_required",
                  service: "google-calendar",
                  message:
                    "Please connect your Google Calendar to create events",
                  connectButton: {
                    text: "Connect Google Calendar",
                    action: "connection://google-calendar",
                  },
                },
              };
            }

            // Mock successful result - in a real implementation this would call the Google Calendar API
            return {
              success: true,
              data: {
                calendarEventId: `event-${Date.now()}`,
                title: data.title,
                startTime: data.startTime,
                endTime: data.endTime,
              },
            };
          } catch (error) {
            console.error("Direct calendar implementation error:", error);
            return {
              success: false,
              error:
                error instanceof Error
                  ? error.message
                  : "Unknown calendar error",
            };
          }
        },
      };
    }

    // Return a streaming response
    return createDataStreamResponse({
      execute: (dataStream) => {
        // Create a wrapper for the dataStream with proper append method
        const streamAdapter = createStreamAdapter(dataStream);

        // Define the tools object to handle both required and optional tools
        const toolsObject: any = {
          getWeather,
          createDocument: createDocument({
            session: userSession,
            dataStream: streamAdapter,
          }),
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
              email: z
                .string()
                .optional()
                .describe("Contact email to search for"),
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
                console.log("Looking up contact information:", {
                  name,
                  email,
                  id,
                });

                if (!crmContactsTool) {
                  return {
                    success: false,
                    error: "CRM contacts tool not available",
                    message:
                      "Unable to access CRM contacts. Please connect your CRM.",
                    ui: {
                      type: "connection_required",
                      service: "crm",
                      message: "Please connect your CRM to access contacts",
                      connectButton: {
                        text: "Connect CRM",
                        action: "connection://crm",
                      },
                    },
                  };
                }

                // Search by whatever parameter was provided
                const result = await crmContactsTool.execute(userId, {
                  name,
                  email,
                  id,
                });
                console.log("CRM contact lookup result:", result);

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
          // Add a dedicated Zoom meeting creation tool
          createZoomMeeting: {
            description: "Create a Zoom meeting and get the meeting link",
            parameters: z.object({
              title: z.string().describe("Meeting title"),
              description: z.string().describe("Meeting description/agenda"),
              startTime: z
                .string()
                .describe(
                  "Start time in ISO format (e.g., 2023-05-01T09:00:00)"
                ),
              duration: z.number().describe("Meeting duration in minutes"),
              attendees: z
                .array(z.string())
                .optional()
                .describe("Optional list of attendee emails"),
              settings: z
                .object({
                  joinBeforeHost: z.boolean().optional(),
                  muteUponEntry: z.boolean().optional(),
                  waitingRoom: z.boolean().optional(),
                })
                .optional(),
            }),
            execute: async (data: any) => {
              try {
                console.log("Creating Zoom meeting with data:", data);

                // Get Zoom OAuth token
                const zoomTokenResponse = await getZoomToken(userId);
                if (!zoomTokenResponse || "error" in zoomTokenResponse) {
                  console.log("Zoom access required - returning connection UI");
                  return {
                    success: false,
                    error: "Zoom access required",
                    message:
                      "You need to connect your Zoom account to create meetings.",
                    ui: {
                      type: "connection_required",
                      service: "zoom",
                      message:
                        "Please connect your Zoom account to create meetings",
                      connectButton: {
                        text: "Connect Zoom",
                        action: "connection://zoom",
                      },
                    },
                  };
                }

                // Calculate end time from duration
                const startTime = new Date(data.startTime);
                const endTime = new Date(
                  startTime.getTime() + data.duration * 60000
                );

                // Create Zoom meeting
                const response = await fetch(
                  "https://api.zoom.us/v2/users/me/meetings",
                  {
                    method: "POST",
                    headers: {
                      Authorization: `Bearer ${zoomTokenResponse.token.accessToken}`,
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      topic: data.title,
                      type: 2, // Scheduled meeting
                      start_time: startTime.toISOString(),
                      duration: data.duration,
                      timezone: "UTC",
                      agenda: data.description,
                      settings: {
                        host_video: true,
                        participant_video: true,
                        join_before_host:
                          data.settings?.joinBeforeHost ?? false,
                        mute_upon_entry: data.settings?.muteUponEntry ?? true,
                        waiting_room: data.settings?.waitingRoom ?? true,
                      },
                    }),
                  }
                );

                if (!response.ok) {
                  const errorData = await response.json().catch(() => ({}));
                  console.error("Zoom API error:", errorData);
                  return {
                    success: false,
                    error: `Failed to create Zoom meeting: ${
                      errorData.message || response.statusText
                    }`,
                    message:
                      "There was a problem creating your Zoom meeting. Please try again later.",
                  };
                }

                const zoomMeeting = await response.json();
                console.log("Zoom meeting created:", zoomMeeting);

                return {
                  success: true,
                  meetingId: zoomMeeting.id,
                  joinUrl: zoomMeeting.join_url,
                  startUrl: zoomMeeting.start_url,
                  password: zoomMeeting.password,
                  message: "Zoom meeting created successfully!",
                  formattedMessage: `Zoom meeting "${zoomMeeting.topic}" created successfully! Join here: [Join Zoom Meeting](${zoomMeeting.join_url})`,
                  meetingInfo: {
                    topic: zoomMeeting.topic,
                    startTime: zoomMeeting.start_time,
                    duration: zoomMeeting.duration,
                    timezone: zoomMeeting.timezone,
                    joinUrl: zoomMeeting.join_url,
                  },
                };
              } catch (error) {
                console.error("Error creating Zoom meeting:", error);
                return {
                  success: false,
                  error:
                    error instanceof Error
                      ? error.message
                      : "Unknown error creating Zoom meeting",
                  message:
                    "There was an error creating your Zoom meeting. Please try again later.",
                };
              }
            },
          },
        };

        // Conditionally add calendar tool if available
        if (calendarTool) {
          toolsObject.createCalendarEvent = wrapToolWithTracking(
            {
              description:
                "Create a calendar event for a meeting or appointment",
              parameters: z.object({
                title: z.string().describe("Event title"),
                description: z.string().describe("Event description"),
                startTime: z
                  .string()
                  .describe(
                    "Start time in ISO format (e.g., 2023-05-01T09:00:00)"
                  ),
                endTime: z
                  .string()
                  .describe(
                    "End time in ISO format (e.g., 2023-05-01T10:00:00)"
                  ),
                attendees: z
                  .array(z.string())
                  .describe("Array of attendee names or email addresses"),
                location: z
                  .string()
                  .optional()
                  .describe("Event location (optional)"),
                timeZone: z
                  .string()
                  .optional()
                  .describe("Time zone (optional, defaults to UTC)"),
                zoomMeeting: z
                  .boolean()
                  .optional()
                  .describe("Whether to create a Zoom meeting for this event"),
                lookupContacts: z
                  .boolean()
                  .optional()
                  .describe("Whether to look up attendee emails in CRM"),
              }),
              execute: async (data: any) => {
                try {
                  console.log("Creating calendar event with data:", data);

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
                        console.log(`Looking up contact in CRM: ${attendee}`);
                        try {
                          const contactResult = await crmContactsTool.execute(
                            userId,
                            { name: attendee }
                          );
                          console.log(
                            `CRM lookup result for ${attendee}:`,
                            contactResult
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
                              console.log(
                                `Found email for ${attendee}: ${contactEmail}`
                              );
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
                      console.log(
                        `Using placeholder email for ${attendee}: ${placeholderEmail}`
                      );
                      processedAttendees.push(placeholderEmail);
                    }

                    // Replace attendees with processed list
                    data.attendees = processedAttendees;
                  }

                  console.log(
                    "Creating calendar event with processed attendees:",
                    data.attendees
                  );
                  const result = await calendarImplementation.execute(
                    userId,
                    data
                  );
                  console.log("Calendar creation result:", result);

                  if (result.success) {
                    // Include the actual calendar link in the response
                    const eventId = result.data?.calendarEventId;
                    const calendarLink = `https://calendar.google.com/calendar/event?eid=${eventId}`;

                    return {
                      success: true,
                      eventId,
                      calendarLink,
                      message: "Calendar event created successfully!",
                      formattedMessage: `Calendar event "${data.title}" created successfully! You can view it here: [Calendar Event](${calendarLink})`,
                      ...result.data,
                    };
                  } else {
                    // Check if this is a connection error
                    if (
                      result.error?.includes("token") ||
                      result.error?.includes("connection")
                    ) {
                      return {
                        success: false,
                        error:
                          result.error || "Failed to create calendar event",
                        message:
                          "There was a problem creating your calendar event. Please try again or check your Google Calendar connection.",
                        ui: {
                          type: "connection_required",
                          service: "google-calendar",
                          message:
                            "Please connect your Google Calendar to create events",
                          connectButton: {
                            text: "Connect Google Calendar",
                            action: "connection://google-calendar",
                          },
                        },
                      };
                    }

                    return {
                      success: false,
                      error: result.error || "Failed to create calendar event",
                      message:
                        "There was a problem creating your calendar event. Please try again or check your Google Calendar connection.",
                      needsConnection:
                        result.error?.includes("token") ||
                        result.error?.includes("connection"),
                    };
                  }
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
            },
            "calendar"
          );
        }

        // Modify the Zoom tool to prevent its use for regular meetings
        const originalZoomTool = toolsObject.createZoomMeeting;
        toolsObject.createZoomMeeting = wrapToolWithTracking(
          {
            description:
              "Create a Zoom video conferencing link (ONLY use when explicitly requested)",
            parameters: originalZoomTool.parameters,
            execute: async (data: any) => {
              // Check if this appears to be a regular meeting that should use calendar instead
              const isCalendarUseCase =
                /meeting|appointment|schedule|sync|call/i.test(data.title) &&
                !/zoom|video conference|virtual meeting/i.test(data.title);

              if (isCalendarUseCase) {
                console.warn(
                  "PREVENTING ZOOM MISUSE: This appears to be a calendar event, redirecting to calendar tool"
                );

                return {
                  success: false,
                  error:
                    "SYSTEM ERROR: Please use createCalendarEvent for scheduling meetings rather than createZoomMeeting",
                  message:
                    "I need to create a proper calendar event for you. Let me try again using Google Calendar.",
                };
              }

              // Otherwise, proceed with Zoom creation
              return originalZoomTool.execute(data);
            },
          },
          "zoom"
        );

        // Add tracking to tools
        toolsObject.getCRMContacts = wrapToolWithTracking(
          toolsObject.getCRMContacts,
          "contacts"
        );
        toolsObject.getCRMDeals = wrapToolWithTracking(
          toolsObject.getCRMDeals,
          "deals"
        );

        // Wrap the document tool with an extra check to prevent misuse for calendar events
        const originalDocumentTool = toolsObject.createDocument;
        toolsObject.createDocument = wrapToolWithTracking(
          {
            description: originalDocumentTool.description,
            parameters: originalDocumentTool.parameters,
            execute: async (data: any) => {
              // Check if this appears to be calendar-related misuse
              const isCalendarMisuse =
                (data.title &&
                  /meeting|appointment|event|call|sync|agenda/i.test(
                    data.title
                  )) ||
                (data.content &&
                  /schedule|calendar|meeting|appointment|zoom/i.test(
                    data.content
                  ));

              if (isCalendarMisuse) {
                console.error(
                  "CRITICAL ERROR: Document tool misuse detected for calendar purposes!"
                );
                console.error(
                  "This is a potential violation of system instructions."
                );
                console.error("Data that triggered this warning:", data);

                // Return an error that explains the correct tool to use
                return {
                  success: false,
                  error:
                    "SYSTEM ERROR: Calendar features must use createCalendarEvent tool, not document creation",
                  message:
                    "I apologize, but I need to create a proper calendar event for you instead of a document. Please let me try again with the correct approach.",
                };
              }

              // If not calendar misuse, proceed with normal document creation
              return originalDocumentTool.execute(data);
            },
          },
          "document"
        );

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
            // Enhanced debugging for tool usage issues
            console.log("========== CONVERSATION DEBUG INFO ==========");
            console.log("Tool usage during conversation:", toolUsage);
            console.log("Calendar tool available:", !!calendarTool);

            // Find the last assistant message for debugging
            const lastAssistantMessage = response.messages.find(
              (m) => m.role === "assistant"
            );

            // Log the model's decision-making through tool calls if available
            if (
              lastAssistantMessage &&
              (lastAssistantMessage as any).tool_calls
            ) {
              const toolCalls = (lastAssistantMessage as any).tool_calls;
              console.log(
                "Tool calls made during conversation:",
                toolCalls.map((c: any) => ({
                  tool: c.name,
                  args: c.args,
                }))
              );
            } else {
              console.log(
                "WARNING: No tool calls were found in the assistant messages"
              );
            }

            // Check for scheduling keywords without calendar tool usage
            if (!toolUsage.calendar && lastAssistantMessage) {
              const content =
                typeof lastAssistantMessage.content === "string"
                  ? lastAssistantMessage.content
                  : JSON.stringify(lastAssistantMessage.content);

              if (
                /\b(schedule|meeting|appointment|calendar|event)\b/i.test(
                  content
                )
              ) {
                console.error(
                  "CRITICAL ERROR: Scheduling content detected but calendar tool was NOT used!"
                );
                console.error("AI Response:", content);
              }
            }

            // Check if document creation was used but calendar/zoom wasn't
            if (toolUsage.document && !(toolUsage.calendar || toolUsage.zoom)) {
              console.error(
                "CRITICAL ERROR: Document tool was used instead of calendar/zoom tools!"
              );
              console.error(
                "This indicates the AI is ignoring the system instructions."
              );
            }

            console.log("==============================================");

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

                    // Look for special response handlers in the assistant message content
                    const toolResponses =
                      (assistantMessage as any).tool_responses || [];

                    // Check if any tool returned a formatted message
                    for (const toolResponse of toolResponses) {
                      if (toolResponse?.output?.formattedMessage) {
                        console.log(
                          "Found formatted message in tool response:",
                          toolResponse.output.formattedMessage
                        );
                        // For links generated by our tools, we want to make sure they're preserved and properly formatted
                        messageText = messageText.replace(
                          /Calendar event created successfully!|Zoom meeting created successfully!/g,
                          toolResponse.output.formattedMessage
                        );
                      }
                    }

                    // Format remaining links for better display in the chat UI
                    messageText = formatLinksForDisplay(messageText);
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
                      parts: [
                        {
                          text:
                            messageText +
                            // Check for direct reference to Zoom connection in the message text
                            (messageText.includes(
                              "connect your Zoom account"
                            ) ||
                            messageText.includes("connect to Zoom") ||
                            toolUsage.zoom
                              ? `\n\n<connection:${JSON.stringify({
                                  type: "connection_required",
                                  service: "zoom",
                                  message:
                                    "Please connect your Zoom account to create meetings",
                                  connectButton: {
                                    text: "Connect Zoom",
                                    action: "connection://zoom",
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
    console.log(
      "Extracting UI elements from message:",
      message.tool_responses
        ? `Found ${message.tool_responses.length} tool responses`
        : "No tool responses found"
    );

    // Check if the message contains tool responses
    const toolResponses = message.tool_responses || [];

    // Look for connection_required UI elements in any tool response
    for (const response of toolResponses) {
      console.log(
        "Tool response:",
        response.tool_name,
        response.output ? "has output" : "no output"
      );
      if (response?.output?.ui?.type === "connection_required") {
        console.log(
          "Found connection UI in tool response:",
          JSON.stringify(response.output.ui)
        );
        return response.output.ui;
      }
    }

    // Also check if the message content contains any connection text markers
    if (message.content && typeof message.content === "string") {
      const connectionRegex =
        /connect your (Zoom|Google Calendar|CRM) account/i;
      const match = message.content.match(connectionRegex);

      if (match) {
        console.log(
          "Detected connection request in message content:",
          match[1]
        );
        // Determine the service type from the content
        let service = "unknown";
        if (match[1].toLowerCase().includes("zoom")) service = "zoom";
        else if (match[1].toLowerCase().includes("calendar"))
          service = "google-calendar";
        else if (match[1].toLowerCase().includes("crm")) service = "crm";

        // Return a generic connection UI object
        return {
          type: "connection_required",
          service,
          message: `Please connect your ${service} account to continue`,
          connectButton: {
            text: `Connect ${service}`,
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
