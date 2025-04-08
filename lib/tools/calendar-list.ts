import { Tool, ToolConfig, ToolResponse, toolRegistry } from "./base";
import { getOAuthTokenWithScopeValidation } from "../oauth-utils";
import { google } from "googleapis";

export interface ListEventsArgs {
  maxResults?: number;
  timeMin?: string;
  timeMax?: string;
  calendarId?: string;
}

export class CalendarListTool extends Tool<ListEventsArgs> {
  config: ToolConfig = {
    id: "google-calendar-list",
    name: "Google Calendar List",
    description: "List upcoming events from Google Calendar",
    scopes: ["https://www.googleapis.com/auth/calendar"],
    requiredFields: [],
    optionalFields: ["maxResults", "timeMin", "timeMax", "calendarId"],
    capabilities: [
      "View upcoming calendar events",
      "Check availability",
      "See event details",
      "View event schedules",
    ],
  };

  validate(data: ListEventsArgs): ToolResponse | null {
    return null;
  }

  async execute(userId: string, data: ListEventsArgs): Promise<ToolResponse> {
    try {
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

      // Set up Google Calendar API client
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({
        access_token: tokenResponse.token.accessToken,
      });
      const calendar = google.calendar({ version: "v3", auth: oauth2Client });

      // Prepare parameters for the API call
      const params: any = {
        calendarId: data.calendarId || "primary",
        maxResults: data.maxResults || 10,
        singleEvents: true,
        orderBy: "startTime",
        fields:
          "items(id,summary,description,start,end,location,attendees,htmlLink)",
      };

      // Add time range if provided
      if (data.timeMin) {
        params.timeMin = data.timeMin;
      } else {
        // Default to now if no timeMin is provided
        params.timeMin = new Date().toISOString();
      }

      if (data.timeMax) {
        params.timeMax = data.timeMax;
      }

      // List the events
      const response = await calendar.events.list(params);

      return {
        success: true,
        data: {
          events: response.data.items || [],
        },
      };
    } catch (error) {
      console.error("Error listing calendar events:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to list calendar events",
        ui: {
          type: "connection_required",
          service: "google-calendar",
          message:
            "There was an error listing your calendar events. Please try again.",
          connectButton: {
            text: "Retry",
            action: "retry",
          },
        },
      };
    }
  }
}

// Register the calendar list tool
toolRegistry.register(new CalendarListTool());
