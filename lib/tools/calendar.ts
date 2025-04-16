import {
  Tool,
  ToolConfig,
  ToolResponse,
  toolRegistry,
  createConnectionRequest,
} from "./base";
import { getOAuthTokenWithScopeValidation } from "../oauth-utils";
import { google } from "googleapis";
import { getCurrentDateContext } from "../date-utils";

export interface CalendarEvent {
  id?: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  attendees?: string[];
  location?: string;
  timeZone?: string;
  lookupContacts?: boolean;
}

export class CalendarTool extends Tool<CalendarEvent> {
  config: ToolConfig = {
    id: "google-calendar",
    name: "Google Calendar",
    description: "Create and manage calendar events",
    scopes: ["https://www.googleapis.com/auth/calendar"],
    requiredFields: ["title", "startTime", "endTime"],
    optionalFields: [
      "description",
      "attendees",
      "location",
      "timeZone",
      "lookupContacts",
    ],
    capabilities: [
      "Create calendar events",
      "Schedule meetings",
      "Add attendees to events",
      "Set event locations",
      "Manage event details",
    ],
  };

  validate(data: CalendarEvent): ToolResponse | null {
    // Get current date context for validation
    const dateContext = getCurrentDateContext();

    if (!data.title) {
      return {
        success: false,
        error: "Missing title",
        needsInput: {
          field: "title",
          message: "Please provide an event title",
        },
      };
    }

    if (!data.startTime) {
      return {
        success: false,
        error: "Missing start time",
        needsInput: {
          field: "startTime",
          message: `Please provide a start time. Today is ${dateContext.currentDate}.`,
        },
      };
    }

    if (!data.endTime) {
      return {
        success: false,
        error: "Missing end time",
        needsInput: {
          field: "endTime",
          message: `Please provide an end time. Today is ${dateContext.currentDate}.`,
        },
      };
    }

    // Validate email format for attendees if provided
    if (data.attendees && data.attendees.length > 0) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const invalidEmails = data.attendees.filter(
        (email) => !emailRegex.test(email)
      );

      if (invalidEmails.length > 0) {
        return {
          success: false,
          error: "Invalid email format",
          needsInput: {
            field: "attendees",
            message: `Invalid email format: ${invalidEmails.join(", ")}`,
            currentValue: data.attendees,
          },
        };
      }
    }

    return null;
  }

  async execute(userId: string, data: CalendarEvent): Promise<ToolResponse> {
    try {
      // Include date context when logging
      const dateContext = getCurrentDateContext();
      console.log("Creating calendar event:", {
        title: data.title,
        startTime: data.startTime,
        endTime: data.endTime,
        attendees: data.attendees,
        timezone: data.timeZone,
        currentDate: dateContext.currentDate, // Include current date for context
      });

      // Get OAuth token for the user
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

      // Check for token error
      if (!tokenResponse || "error" in tokenResponse) {
        // Safely extract any available scopes information
        const requiredScopes =
          "requiredScopes" in tokenResponse
            ? tokenResponse.requiredScopes
            : ["https://www.googleapis.com/auth/calendar"];
        const currentScopes =
          "currentScopes" in tokenResponse
            ? tokenResponse.currentScopes
            : undefined;

        return {
          success: false,
          error: tokenResponse
            ? tokenResponse.error
            : "Calendar access required",
          ui: {
            type: "connection_required",
            service: "google-calendar",
            message: "Google Calendar access is required to create events.",
            connectButton: {
              text: "Connect Google Calendar",
              action: "connection://google-calendar",
            },
            alternativeMessage:
              "This will allow the assistant to create and manage calendar events on your behalf.",
            requiredScopes: requiredScopes,
          },
        };
      }

      // Set up Google Calendar API client
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({
        access_token: tokenResponse.token?.accessToken,
      });
      const calendar = google.calendar({ version: "v3", auth: oauth2Client });

      // Prepare event data
      const event = {
        summary: data.title,
        description: data.description,
        start: {
          dateTime: data.startTime,
          timeZone: data.timeZone || "UTC",
        },
        end: {
          dateTime: data.endTime,
          timeZone: data.timeZone || "UTC",
        },
        location: data.location,
        attendees: data.attendees?.map((email) => ({ email })),
      };

      // Create the calendar event
      console.log("Sending calendar event creation request to Google API");
      const response = await calendar.events.insert({
        calendarId: "primary",
        requestBody: event,
        // Add this for better link handling
        conferenceDataVersion: 1,
      });

      // Log the successful response from Google Calendar API
      console.log("Calendar event created successfully:", {
        eventId: response.data.id,
        eventLink: response.data.htmlLink,
        summary: response.data.summary,
        status: response.status,
      });

      // Extract event links
      const htmlLink = response.data.htmlLink || null;
      const hangoutLink = response.data.hangoutLink || null;

      // Create a formatted response with a working link
      const eventLink =
        htmlLink ||
        `https://calendar.google.com/calendar/event?eid=${response.data.id}`;

      // Create a formatted message for displaying in chat
      const formattedMessage = `Calendar event "${response.data.summary}" created successfully! [View in Google Calendar](${eventLink})`;

      return {
        success: true,
        data: {
          calendarEventId: response.data.id,
          calendarEventLink: eventLink,
          conferenceLink: hangoutLink,
          htmlLink: htmlLink,
          formattedMessage: formattedMessage,
          title: response.data.summary,
          startTime: response.data.start?.dateTime,
          endTime: response.data.end?.dateTime,
          attendees: response.data.attendees
            ?.map((a) => a.email || "")
            .filter((email) => email !== ""),
        },
      };
    } catch (error) {
      console.error("Error creating calendar event:", error);

      // Check if this is an authentication or permission error
      const errorMsg =
        error instanceof Error
          ? error.message
          : "Failed to create calendar event";
      const isAuthError =
        errorMsg.includes("auth") ||
        errorMsg.includes("permission") ||
        errorMsg.includes("token") ||
        errorMsg.includes("unauthorized") ||
        errorMsg.includes("access") ||
        errorMsg.includes("403") ||
        errorMsg.includes("401");

      if (isAuthError) {
        return {
          success: false,
          error: errorMsg,
          ui: {
            type: "connection_required",
            service: "google-calendar",
            message: "Google Calendar access is required to create events.",
            connectButton: {
              text: "Connect Google Calendar",
              action: "connection://google-calendar",
            },
            alternativeMessage:
              "This will allow the assistant to create and manage calendar events on your behalf.",
          },
        };
      }

      return {
        success: false,
        error: errorMsg,
        ui: {
          type: "error",
          message:
            "There was an error creating your calendar event. Please try again.",
        },
      };
    }
  }
}

// Register the calendar tool
toolRegistry.register(new CalendarTool());
