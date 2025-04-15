import { Tool, ToolConfig, ToolResponse, toolRegistry } from "./base";
import { getOAuthTokenWithScopeValidation } from "../oauth-utils";
import { google } from "googleapis";
import { getRequiredScopes } from "@/lib/openapi-utils";

export interface GoogleMeetEvent {
  title: string;
  description?: string;
  startTime: string;
  duration: number;
  attendees?: string[];
  timeZone?: string;
  settings?: {
    muteUponEntry?: boolean;
    joinBeforeHost?: boolean;
  };
}

export class GoogleMeetTool extends Tool<GoogleMeetEvent> {
  config: ToolConfig = {
    id: "google-meet",
    name: "Google Meet",
    description: "Create Google Meet meetings and get meeting links",
    scopes: ["https://www.googleapis.com/auth/calendar"],
    requiredFields: ["title", "startTime", "duration"],
    optionalFields: ["description", "attendees", "timeZone", "settings"],
    capabilities: [
      "Create Google Meet meetings",
      "Generate meeting links",
      "Schedule video conferences",
      "Manage meeting settings",
    ],
  };

  validate(data: GoogleMeetEvent): ToolResponse | null {
    if (!data.title) {
      return {
        success: false,
        error: "Missing title",
        needsInput: {
          field: "title",
          message: "Please provide a meeting title",
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

    if (!data.duration) {
      return {
        success: false,
        error: "Missing duration",
        needsInput: {
          field: "duration",
          message: "Please provide a meeting duration in minutes",
        },
      };
    }

    return null;
  }

  async execute(userId: string, data: GoogleMeetEvent): Promise<ToolResponse> {
    try {
      // Get OAuth token for Google Calendar
      const tokenResponse = await getOAuthTokenWithScopeValidation(
        userId,
        "google-meet",
        {
          appId: "google-meet",
          userId,
          scopes: this.config.scopes,
          operation: "tool_calling",
        }
      );

      if (!tokenResponse || "error" in tokenResponse) {
        return {
          success: false,
          error: "Google Meet access required",
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

      // Set up Google Calendar API client
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({
        access_token: tokenResponse.token?.accessToken,
      });
      const calendar = google.calendar({ version: "v3", auth: oauth2Client });

      // Calculate end time from duration
      const startTime = new Date(data.startTime);
      const endTime = new Date(startTime.getTime() + data.duration * 60000);

      // Prepare event data with conferenceData for Google Meet
      const event = {
        summary: data.title,
        description: data.description,
        start: {
          dateTime: startTime.toISOString(),
          timeZone: data.timeZone || "UTC",
        },
        end: {
          dateTime: endTime.toISOString(),
          timeZone: data.timeZone || "UTC",
        },
        attendees: data.attendees?.map((email) => ({ email })),
        conferenceData: {
          createRequest: {
            requestId: `meet-${Date.now()}`,
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
      };

      // Create the calendar event with Google Meet
      const response = await calendar.events.insert({
        calendarId: "primary",
        requestBody: event,
        conferenceDataVersion: 1, // Required to create a Meet link
      });

      // Extract Meet link from the response
      const meetLink = response.data.conferenceData?.entryPoints?.find(
        (entry) => entry.entryPointType === "video"
      )?.uri;

      return {
        success: true,
        data: {
          meetingId: response.data.id,
          joinUrl: meetLink,
          startUrl: response.data.hangoutLink,
          formattedMessage: `Google Meet "${response.data.summary}" created successfully! Join here: [Join Google Meet](${meetLink})`,
          meetingInfo: {
            topic: response.data.summary,
            startTime: response.data.start?.dateTime,
            duration: data.duration,
            timezone: response.data.start?.timeZone || "UTC",
            joinUrl: meetLink,
          },
        },
      };
    } catch (error) {
      console.error("Error creating Google Meet:", error);

      // Check if this is an insufficient permissions error
      const isInsufficientPermissions =
        error instanceof Error &&
        (error.message.includes("Insufficient Permission") ||
          error.message.includes("403") ||
          (error as any).code === 403);

      if (isInsufficientPermissions) {
        // Get the required scopes from the OpenAPI spec
        const requiredScopes = await getRequiredScopes(
          "google-meet",
          "meetings.space"
        );

        return {
          success: false,
          status: "error",
          error: "Insufficient permissions to create Google Meet",
          ui: {
            type: "connection_required",
            service: "google-meet",
            message:
              "You need additional permissions to create Google Meet meetings. Please reconnect with the required scopes.",
            requiredScopes: requiredScopes,
            connectButton: {
              text: "Reconnect Google Meet",
              action: "connection://google-meet",
            },
          },
        };
      }

      // Default error response
      return {
        success: false,
        status: "error",
        error:
          error instanceof Error
            ? error.message
            : "Failed to create Google Meet",
        ui: {
          type: "error",
          message:
            "There was an error creating your Google Meet. Please try again later.",
        },
      };
    }
  }
}

// Register the Google Meet tool
toolRegistry.register(new GoogleMeetTool());
