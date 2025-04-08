import { getOAuthTokenWithScopeValidation } from "../oauth-utils";
import { Tool, ToolConfig, ToolResponse, toolRegistry } from "./base";
import { getRequiredScopes } from "../openapi-utils";

interface CalendarEvent {
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  attendees: string[];
  location?: string;
  timeZone?: string;
  recurrence?: string[];
  reminders?: {
    method: string;
    minutes: number;
  }[];
  zoomMeeting?: boolean;
}

interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  attendees: Array<{ email: string }>;
  location?: string;
  recurrence?: string[];
  reminders?: {
    method: string;
    minutes: number;
  }[];
}

const calendarConfig: ToolConfig = {
  id: "calendar",
  name: "Calendar",
  description: "Create and manage calendar events",
  scopes: [],
  requiredFields: ["summary", "start", "end"],
  optionalFields: ["description", "attendees"],
  capabilities: [
    "Schedule meetings and events",
    "Manage event details and timing",
    "Add attendees and send invitations",
    "Track event responses and updates",
    "Handle recurring events and series",
  ],
};

async function createCalendarEvent(
  token: string,
  event: CalendarEvent
): Promise<GoogleCalendarEvent> {
  const response = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: event.title,
        description: event.description,
        start: {
          dateTime: event.startTime,
          timeZone: event.timeZone || "UTC",
        },
        end: {
          dateTime: event.endTime,
          timeZone: event.timeZone || "UTC",
        },
        attendees: event.attendees.map((email) => ({ email })),
        location: event.location,
        recurrence: event.recurrence,
        reminders: event.reminders,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      `Failed to create calendar event: ${
        error.error?.message || response.statusText
      }`
    );
  }

  return response.json();
}

async function createZoomMeeting(token: string, event: CalendarEvent) {
  const response = await fetch("https://api.zoom.us/v2/users/me/meetings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      topic: event.title,
      type: 2, // Scheduled meeting
      start_time: event.startTime,
      duration: Math.round(
        (new Date(event.endTime).getTime() -
          new Date(event.startTime).getTime()) /
          (1000 * 60)
      ), // Duration in minutes
      timezone: event.timeZone || "UTC",
      agenda: event.description,
      settings: {
        host_video: true,
        participant_video: true,
        join_before_host: false,
        mute_upon_entry: true,
        waiting_room: true,
        meeting_authentication: true,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      `Failed to create Zoom meeting: ${error.message || response.statusText}`
    );
  }

  const data = await response.json();
  return data.id;
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

class CalendarTool extends Tool<CalendarEvent> {
  config: ToolConfig = calendarConfig;

  validate(data: CalendarEvent): ToolResponse | null {
    // Check required fields
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

    if (!data.startTime || !data.endTime) {
      return {
        success: false,
        error: "Missing time",
        needsInput: {
          field: "time",
          message: "Please provide meeting start and end times",
        },
      };
    }

    // Validate dates
    const start = new Date(data.startTime);
    const end = new Date(data.endTime);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return {
        success: false,
        error: "Invalid dates",
        needsInput: {
          field: "time",
          message: "Please provide valid meeting dates and times",
        },
      };
    }

    if (end <= start) {
      return {
        success: false,
        error: "Invalid duration",
        needsInput: {
          field: "time",
          message: "Please provide valid meeting duration",
        },
      };
    }

    // Validate attendees if provided
    if (data.attendees && data.attendees.length > 0) {
      const invalidEmails = data.attendees.filter(
        (email) => !isValidEmail(email)
      );
      if (invalidEmails.length > 0) {
        return {
          success: false,
          error: "Invalid emails",
          needsInput: {
            field: "attendees",
            message: "Please provide valid email addresses",
            currentValue: data.attendees.join(", "),
          },
        };
      }
    }

    return null;
  }

  async execute(userId: string, data: CalendarEvent): Promise<ToolResponse> {
    try {
      const validationError = this.validate(data);
      if (validationError) {
        return validationError;
      }

      // Get required scopes for calendar operations
      const calendarScopes = await getRequiredScopes(
        "google-calendar",
        "events.create"
      );

      // Get OAuth token for Google Calendar
      const calendarTokenResponse = await getOAuthTokenWithScopeValidation(
        userId,
        "google-calendar",
        {
          appId: "google-calendar",
          userId,
          scopes: calendarScopes,
        }
      );

      if ("error" in calendarTokenResponse) {
        return {
          success: false,
          error: calendarTokenResponse.error,
        };
      }

      // Create calendar event
      try {
        const calendarEvent = await createCalendarEvent(
          calendarTokenResponse.token.accessToken,
          data
        );

        if (!calendarEvent?.id) {
          return {
            success: false,
            error: "Failed to create calendar event: No event ID returned",
          };
        }

        // If Zoom meeting is requested, create it
        let zoomMeetingId;
        if (data.zoomMeeting) {
          // Get required scopes for Zoom operations
          const zoomScopes = await getRequiredScopes("zoom", "meetings.create");

          const zoomTokenResponse = await getOAuthTokenWithScopeValidation(
            userId,
            "zoom",
            {
              appId: "zoom",
              userId,
              scopes: zoomScopes,
            }
          );

          if ("error" in zoomTokenResponse) {
            return {
              success: false,
              error: zoomTokenResponse.error,
            };
          }

          zoomMeetingId = await createZoomMeeting(
            zoomTokenResponse.token.accessToken,
            data
          );
        }

        return {
          success: true,
          data: {
            calendarEventId: calendarEvent.id,
            ...(zoomMeetingId ? { zoomMeetingId } : {}),
          },
        };
      } catch (error: any) {
        // Handle specific Google Calendar API errors
        if (error.message?.includes("Invalid attendee email")) {
          return {
            success: false,
            error: "Invalid emails",
            needsInput: {
              field: "attendees",
              message: "Please verify the email addresses",
              currentValue: data.attendees.join(", "),
            },
          };
        }
        return {
          success: false,
          error: error.message,
        };
      }
    } catch (error) {
      console.error("[calendarTool] Error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }
}

// Register the calendar tool
toolRegistry.register(new CalendarTool());

// Export the calendar tool for direct use if needed
export { CalendarTool };
