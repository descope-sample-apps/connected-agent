// Import API initialization to ensure all tools are registered
import "@/app/api/_init";

import { streamText } from "ai";
import { toolRegistry } from "@/lib/tools";
import { z } from "zod";
import { getOAuthTokenWithScopeValidation } from "@/lib/oauth-utils";
import { google } from "googleapis";
import { session } from "@descope/nextjs-sdk/server";
import { systemPrompt } from "@/lib/ai/prompts";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { myProvider } from "@/lib/ai/providers";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    // Get user session
    const userSession = await session();
    if (!userSession?.token?.sub) {
      return new Response("Unauthorized", { status: 401 });
    }

    const userId = userSession.token.sub;

    // Create response with tools
    const response = streamText({
      model: myProvider.languageModel(DEFAULT_CHAT_MODEL),
      system: systemPrompt(),
      messages,
      tools: {
        // Calendar List Tool
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
          execute: async ({
            maxResults = 5,
            timeMin,
            timeMax,
            calendarId = "primary",
          }) => {
            // Get OAuth token for Google Calendar
            const tokenResponse = await getOAuthTokenWithScopeValidation(
              userId,
              "google-calendar",
              {
                appId: "google-calendar",
                userId,
                scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
                operation: "tool_calling",
              }
            );

            if (!tokenResponse || "error" in tokenResponse) {
              return {
                success: false,
                error: "Google Calendar access required",
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

            try {
              // Set up Google Calendar API client
              const oauth2Client = new google.auth.OAuth2();
              oauth2Client.setCredentials({
                access_token: tokenResponse.token.accessToken,
              });
              const calendar = google.calendar({
                version: "v3",
                auth: oauth2Client,
              });

              // Prepare parameters for the API call
              const params: any = {
                calendarId,
                maxResults,
                singleEvents: true,
                orderBy: "startTime",
                fields:
                  "items(id,summary,description,start,end,location,attendees,htmlLink)",
              };

              // Add time range if provided
              if (timeMin) {
                params.timeMin = timeMin;
              } else {
                // Default to now if no timeMin is provided
                params.timeMin = new Date().toISOString();
              }

              if (timeMax) {
                params.timeMax = timeMax;
              }

              // List the events
              const response = await calendar.events.list(params);

              // Format the events for display
              const formattedEvents = (response.data.items || []).map(
                (event: any) => ({
                  id: event.id,
                  title: event.summary,
                  description: event.description,
                  start: event.start?.dateTime || event.start?.date,
                  end: event.end?.dateTime || event.end?.date,
                  location: event.location,
                  link: event.htmlLink,
                  attendees:
                    event.attendees?.map((a: { email: string }) => a.email) ||
                    [],
                })
              );

              return formattedEvents;
            } catch (error) {
              console.error("Error listing calendar events:", error);
              throw new Error(
                error instanceof Error
                  ? error.message
                  : "Failed to list calendar events"
              );
            }
          },
        },
        // Calendar Create Tool
        createCalendarEvent: {
          description: "Create a calendar event",
          parameters: z.object({
            title: z.string().describe("Event title"),
            description: z.string().optional().describe("Event description"),
            startTime: z.string().describe("Start time (ISO format)"),
            endTime: z.string().describe("End time (ISO format)"),
            attendees: z
              .array(z.string())
              .optional()
              .describe("List of attendee emails"),
            location: z.string().optional().describe("Location of the event"),
          }),
          execute: async ({
            title,
            description,
            startTime,
            endTime,
            attendees,
            location,
          }) => {
            // Get OAuth token for Google Calendar
            const tokenResponse = await getOAuthTokenWithScopeValidation(
              userId,
              "google-calendar",
              {
                appId: "google-calendar",
                userId,
                scopes: ["https://www.googleapis.com/auth/calendar"],
                operation: "tool_calling",
              }
            );

            if (!tokenResponse || "error" in tokenResponse) {
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

            try {
              // Set up Google Calendar API client
              const oauth2Client = new google.auth.OAuth2();
              oauth2Client.setCredentials({
                access_token: tokenResponse.token.accessToken,
              });
              const calendar = google.calendar({
                version: "v3",
                auth: oauth2Client,
              });

              // Prepare event data
              const event = {
                summary: title,
                description,
                start: {
                  dateTime: startTime,
                  timeZone: "UTC",
                },
                end: {
                  dateTime: endTime,
                  timeZone: "UTC",
                },
                location,
                attendees: attendees?.map((email: string) => ({ email })),
              };

              // Create the calendar event
              const response = await calendar.events.insert({
                calendarId: "primary",
                requestBody: event,
              });

              return {
                id: response.data.id,
                title: response.data.summary,
                link: response.data.htmlLink,
                start: response.data.start?.dateTime,
                end: response.data.end?.dateTime,
              };
            } catch (error) {
              console.error("Error creating calendar event:", error);
              throw new Error(
                error instanceof Error
                  ? error.message
                  : "Failed to create calendar event"
              );
            }
          },
        },
      },
    });

    return response.toDataStreamResponse();
  } catch (error) {
    console.error("Error in chat2 route:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "An error occurred",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
