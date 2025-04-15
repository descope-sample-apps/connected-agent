import {
  Tool,
  ToolConfig,
  ToolResponse,
  toolRegistry,
  createConnectionRequest,
  OAuthProvider,
} from "./base";
import { getOAuthTokenWithScopeValidation } from "../oauth-utils";
import { google } from "googleapis";

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
          message: "Please provide a start time",
        },
      };
    }

    if (!data.endTime) {
      return {
        success: false,
        error: "Missing end time",
        needsInput: {
          field: "endTime",
          message: "Please provide an end time",
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
      console.log("Creating calendar event:", {
        title: data.title,
        startTime: data.startTime,
        endTime: data.endTime,
        attendees: data.attendees,
        timezone: data.timeZone,
      });

      // Get OAuth token for Google Calendar
      const tokenResponse = await getOAuthTokenWithScopeValidation(
        userId,
        "google-calendar",
        {
          appId: "google-calendar",
          userId,
          scopes: this.config.scopes,
          operation: "tool_calling",
        }
      );

      if (!tokenResponse || "error" in tokenResponse) {
        // Check if we have required scopes information
        const requiredScopes =
          "requiredScopes" in tokenResponse
            ? tokenResponse.requiredScopes
            : this.config.scopes;

        const isReconnect =
          "error" in tokenResponse &&
          tokenResponse.error === "insufficient_scopes";

        return createConnectionRequest({
          provider: "google-calendar",
          isReconnect,
          requiredScopes,
          customMessage: isReconnect
            ? "Additional calendar permissions are needed to create events."
            : "Please connect your Google Calendar to create events",
        });
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
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create calendar event",
        ui: {
          type: "connection_required",
          service: "google-calendar",
          message:
            "There was an error creating your calendar event. Please try again.",
          connectButton: {
            text: "Retry",
            action: "retry",
          },
        },
      };
    }
  }
}

// Register the calendar tool
toolRegistry.register(new CalendarTool());
