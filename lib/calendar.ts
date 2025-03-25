import { getOAuthTokenWithScopeValidation } from "./oauth-utils";

interface ScheduleMeetingResponse {
  calendarEventId: string;
  zoomMeetingId?: string;
  message?: string;
  needsInput?: {
    field: string;
    message: string;
    currentValue?: string;
  };
}

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
}

async function createCalendarEvent(token: string, event: CalendarEvent) {
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

function validateEvent(event: CalendarEvent): ScheduleMeetingResponse | null {
  // Check required fields
  if (!event.title) {
    return {
      calendarEventId: "NEEDS_TITLE",
      message: "I need a title for this meeting. Could you please provide one?",
      needsInput: {
        field: "title",
        message: "Please provide a meeting title",
      },
    };
  }

  if (!event.startTime || !event.endTime) {
    return {
      calendarEventId: "NEEDS_TIME",
      message:
        "I need both start and end times for this meeting. Could you please provide them?",
      needsInput: {
        field: "time",
        message: "Please provide meeting start and end times",
      },
    };
  }

  // Validate dates
  const start = new Date(event.startTime);
  const end = new Date(event.endTime);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return {
      calendarEventId: "INVALID_DATES",
      message:
        "The provided dates are invalid. Please provide valid dates and times.",
      needsInput: {
        field: "time",
        message: "Please provide valid meeting dates and times",
      },
    };
  }

  if (end <= start) {
    return {
      calendarEventId: "INVALID_DURATION",
      message:
        "The end time must be after the start time. Could you please adjust the times?",
      needsInput: {
        field: "time",
        message: "Please provide valid meeting duration",
      },
    };
  }

  // Validate attendees if provided
  if (event.attendees && event.attendees.length > 0) {
    const invalidEmails = event.attendees.filter(
      (email) => !isValidEmail(email)
    );
    if (invalidEmails.length > 0) {
      return {
        calendarEventId: "INVALID_EMAILS",
        message: `I noticed some invalid email addresses: ${invalidEmails.join(
          ", "
        )}. Please provide valid email addresses in the format: example@domain.com`,
        needsInput: {
          field: "attendees",
          message: "Please provide valid email addresses",
          currentValue: event.attendees.join(", "),
        },
      };
    }
  }

  return null;
}

export async function scheduleMeeting(
  userId: string,
  event: CalendarEvent,
  zoomMeeting?: boolean
): Promise<ScheduleMeetingResponse> {
  try {
    // Validate event data
    const validationError = validateEvent(event);
    if (validationError) {
      return validationError;
    }

    // Get OAuth token for Google Calendar
    const calendarTokenResponse = await getOAuthTokenWithScopeValidation(
      userId,
      "google-calendar",
      {
        appId: "google-calendar",
        userId,
        scopes: ["https://www.googleapis.com/auth/calendar"],
      }
    );

    if ("error" in calendarTokenResponse) {
      throw new Error(calendarTokenResponse.error);
    }

    // Create calendar event
    try {
      const calendarEvent = await createCalendarEvent(
        calendarTokenResponse.token.accessToken,
        event
      );

      // If Zoom meeting is requested, create it
      let zoomMeetingId;
      if (zoomMeeting) {
        const zoomTokenResponse = await getOAuthTokenWithScopeValidation(
          userId,
          "zoom",
          {
            appId: "zoom",
            userId,
            scopes: ["meeting:write"],
          }
        );

        if ("error" in zoomTokenResponse) {
          throw new Error(zoomTokenResponse.error);
        }

        zoomMeetingId = await createZoomMeeting(
          zoomTokenResponse.token.accessToken,
          event
        );
      }

      return {
        calendarEventId: calendarEvent.id,
        zoomMeetingId,
      };
    } catch (error: any) {
      // Handle specific Google Calendar API errors
      if (error.message?.includes("Invalid attendee email")) {
        return {
          calendarEventId: "INVALID_EMAILS",
          message:
            "Some of the provided email addresses were rejected by Google Calendar. Please verify the email addresses and try again.",
          needsInput: {
            field: "attendees",
            message: "Please verify the email addresses",
            currentValue: event.attendees.join(", "),
          },
        };
      }
      throw error;
    }
  } catch (error) {
    console.error("[scheduleMeeting] Error:", error);
    throw error;
  }
}
