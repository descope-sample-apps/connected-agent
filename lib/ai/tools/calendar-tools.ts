import { z } from "zod";
import { getGoogleCalendarToken } from "@/lib/descope";

interface DataStreamProps {
  append: (data: any) => void;
}

// Helper function to check calendar connection
async function checkCalendarConnection(userId: string) {
  const tokenData = await getGoogleCalendarToken(userId);
  return {
    connected: !!(tokenData && !("error" in tokenData)),
    token: tokenData && !("error" in tokenData) ? tokenData : null,
    error: tokenData && "error" in tokenData ? tokenData.error : null,
  };
}

// Schedule a meeting tool
export function scheduleMeeting({
  userId,
  dataStream,
}: {
  userId: string;
  dataStream: DataStreamProps;
}) {
  return {
    description:
      "Schedule a meeting with contacts in Google Calendar, optionally with a Zoom link",
    parameters: z.object({
      contacts: z
        .array(z.string())
        .describe("The email addresses of the contacts to invite"),
      startDateTime: z
        .string()
        .describe("The start date and time in ISO 8601 format"),
      endDateTime: z
        .string()
        .describe("The end date and time in ISO 8601 format"),
      title: z.string().describe("The title of the meeting"),
      description: z
        .string()
        .optional()
        .describe("The description or agenda for the meeting"),
      location: z
        .string()
        .optional()
        .describe("The location of the meeting (physical or virtual)"),
      useZoom: z
        .boolean()
        .optional()
        .default(false)
        .describe("Whether to generate a Zoom meeting link"),
    }),
    execute: async ({
      contacts,
      startDateTime,
      endDateTime,
      title,
      description = "",
      location = "",
      useZoom = false,
    }) => {
      dataStream.append({
        toolActivity: {
          step: "starting",
          tool: "scheduleMeeting",
          title: "Scheduling Meeting",
          description: `Creating meeting "${title}"...`,
        },
      });

      const connectionStatus = await checkCalendarConnection(userId);

      if (!connectionStatus.connected) {
        dataStream.append({
          toolActivity: {
            step: "error",
            tool: "scheduleMeeting",
            title: "Calendar Connection Required",
            description:
              "Please connect your Google Calendar to schedule meetings.",
          },
        });

        return {
          success: false,
          error:
            "To schedule meetings, please connect your Google Calendar first.",
          needsConnection: true,
          provider: "google-calendar",
        };
      }

      // Calendar API implementation would go here
      // For now, we return mock data
      const meetingId = `meeting-${Math.random()
        .toString(36)
        .substring(2, 10)}`;
      const meetingLink = `https://calendar.google.com/calendar/event/${meetingId}`;

      dataStream.append({
        toolActivity: {
          step: "complete",
          tool: "scheduleMeeting",
          title: "Meeting Scheduled",
          description: "Your meeting has been scheduled successfully!",
          fields: {
            Title: title,
            Time: `${new Date(startDateTime).toLocaleString()} - ${new Date(
              endDateTime
            ).toLocaleString()}`,
            Attendees: contacts.join(", "),
            "Calendar Link": meetingLink,
          },
        },
      });

      return {
        success: true,
        meeting: {
          id: meetingId,
          title,
          startTime: startDateTime,
          endTime: endDateTime,
          attendees: contacts,
          description,
          location,
          link: meetingLink,
        },
      };
    },
  };
}

// Check availability tool
export function checkAvailability({
  userId,
  dataStream,
}: {
  userId: string;
  dataStream: DataStreamProps;
}) {
  return {
    description: "Check calendar availability for a specific date range",
    parameters: z.object({
      startDateTime: z
        .string()
        .describe("The start date and time in ISO 8601 format"),
      endDateTime: z
        .string()
        .describe("The end date and time in ISO 8601 format"),
      timezone: z
        .string()
        .optional()
        .describe("The timezone for the availability check"),
    }),
    execute: async ({ startDateTime, endDateTime, timezone = "UTC" }) => {
      dataStream.append({
        toolActivity: {
          step: "starting",
          tool: "checkAvailability",
          title: "Checking Availability",
          description: "Checking your calendar for available times...",
        },
      });

      const connectionStatus = await checkCalendarConnection(userId);

      if (!connectionStatus.connected) {
        dataStream.append({
          toolActivity: {
            step: "error",
            tool: "checkAvailability",
            title: "Calendar Connection Required",
            description:
              "Please connect your Google Calendar to check availability.",
          },
        });

        return {
          success: false,
          error:
            "To check availability, please connect your Google Calendar first.",
          needsConnection: true,
          provider: "google-calendar",
        };
      }

      // Calendar API implementation would go here
      // For now, we return mock data with simulated free/busy slots
      const busySlots = [
        {
          start: new Date(
            new Date(startDateTime).getTime() + 2 * 60 * 60 * 1000
          ).toISOString(),
          end: new Date(
            new Date(startDateTime).getTime() + 3 * 60 * 60 * 1000
          ).toISOString(),
          title: "Existing meeting",
        },
      ];

      dataStream.append({
        toolActivity: {
          step: "complete",
          tool: "checkAvailability",
          title: "Availability Found",
          description:
            "Here's your availability for the requested time period.",
        },
      });

      return {
        success: true,
        timeRange: {
          start: startDateTime,
          end: endDateTime,
          timezone,
        },
        busySlots,
        availableSlots: [
          {
            start: startDateTime,
            end: busySlots[0].start,
          },
          {
            start: busySlots[0].end,
            end: endDateTime,
          },
        ],
      };
    },
  };
}

// Get upcoming events tool
export function getUpcomingEvents({
  userId,
  dataStream,
}: {
  userId: string;
  dataStream: DataStreamProps;
}) {
  return {
    description: "Get upcoming calendar events",
    parameters: z.object({
      days: z
        .number()
        .optional()
        .default(7)
        .describe("Number of days to look ahead"),
      maxEvents: z
        .number()
        .optional()
        .default(5)
        .describe("Maximum number of events to return"),
    }),
    execute: async ({ days = 7, maxEvents = 5 }) => {
      dataStream.append({
        toolActivity: {
          step: "starting",
          tool: "getUpcomingEvents",
          title: "Fetching Calendar Events",
          description: `Looking up your next ${maxEvents} events...`,
        },
      });

      const connectionStatus = await checkCalendarConnection(userId);

      if (!connectionStatus.connected) {
        dataStream.append({
          toolActivity: {
            step: "error",
            tool: "getUpcomingEvents",
            title: "Calendar Connection Required",
            description: "Please connect your Google Calendar to view events.",
          },
        });

        return {
          success: false,
          error:
            "To view upcoming events, please connect your Google Calendar first.",
          needsConnection: true,
          provider: "google-calendar",
        };
      }

      // Calendar API implementation would go here
      // For now, we return mock data
      const now = new Date();
      const mockEvents = Array.from({ length: maxEvents }, (_, i) => {
        const startTime = new Date(now);
        startTime.setHours(9 + i, 0, 0, 0);
        startTime.setDate(startTime.getDate() + (i % days));

        const endTime = new Date(startTime);
        endTime.setHours(startTime.getHours() + 1);

        return {
          id: `event-${i}`,
          title: `Mock Meeting ${i + 1}`,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          attendees: ["user@example.com", "colleague@example.com"],
          location: i % 2 === 0 ? "Conference Room A" : "Virtual (Zoom)",
        };
      });

      dataStream.append({
        toolActivity: {
          step: "complete",
          tool: "getUpcomingEvents",
          title: "Calendar Events Found",
          description: `Found ${mockEvents.length} upcoming events.`,
        },
      });

      return {
        success: true,
        events: mockEvents,
        timeRange: {
          start: now.toISOString(),
          end: new Date(
            now.getTime() + days * 24 * 60 * 60 * 1000
          ).toISOString(),
        },
      };
    },
  };
}
