import {
  Tool,
  ToolConfig,
  ToolResponse,
  createConnectionRequest,
  toolRegistry,
} from "./base";
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
    description: "List events from Google Calendar",
    scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
    requiredFields: [],
    optionalFields: ["maxResults", "timeMin", "timeMax", "calendarId"],
    capabilities: [
      "List calendar events",
      "Get upcoming meetings",
      "View calendar availability",
    ],
    parameters: {
      maxResults: 10,
      calendarId: "primary",
    },
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
        // Extract scope information if available
        const requiredScopes =
          "requiredScopes" in tokenResponse
            ? tokenResponse.requiredScopes
            : this.config.scopes;
        const currentScopes =
          "currentScopes" in tokenResponse
            ? tokenResponse.currentScopes
            : undefined;

        // Use standardized connection request
        return createConnectionRequest({
          provider: "google-calendar",
          isReconnect: currentScopes && currentScopes.length > 0,
          requiredScopes: requiredScopes,
          currentScopes: currentScopes,
          customMessage: "Please connect your Google Calendar to view events",
        });
      }

      // Set up Google Calendar API client
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({
        access_token: tokenResponse.token!.accessToken,
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
      // Check if this is an authentication/permission error
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      const isAuthError =
        errorMsg.includes("auth") ||
        errorMsg.includes("permission") ||
        errorMsg.includes("token") ||
        errorMsg.includes("401") ||
        errorMsg.includes("403");

      if (isAuthError) {
        return createConnectionRequest({
          provider: "google-calendar",
          customMessage: "Calendar access is required to view events",
        });
      }

      return {
        success: false,
        error: errorMsg,
        ui: {
          type: "error",
          message:
            "There was an error listing your calendar events. Please try again.",
        },
      };
    }
  }
}

// Register the calendar list tool
toolRegistry.register(new CalendarListTool());
