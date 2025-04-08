import { z } from "zod";
import { getGoogleCalendarToken, getZoomToken } from "@/lib/descope";

interface DataStreamProps {
  append: (data: any) => void;
}

export function scheduleMeeting({
  userId,
  dataStream,
}: {
  userId: string;
  dataStream: DataStreamProps;
}) {
  return {
    description: "Schedule a meeting with contacts",
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
    }: {
      contacts: string[];
      startDateTime: string;
      endDateTime: string;
      title: string;
      description?: string;
      location?: string;
      useZoom?: boolean;
    }) => {
      console.log(`Scheduling meeting: "${title}" for user ${userId}`);

      try {
        // Update UI with progress
        dataStream.append({
          toolActivity: {
            step: "starting",
            tool: "scheduleMeeting",
            title: "Scheduling Meeting",
            description: `Scheduling "${title}" meeting...`,
          },
        });

        // Check Google Calendar connection
        const calendarToken = await getGoogleCalendarToken(userId);
        if (!calendarToken || "error" in calendarToken) {
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

        // If Zoom meeting requested, check Zoom connection
        let zoomMeetingLink = "";
        if (useZoom) {
          const zoomToken = await getZoomToken(userId);
          if (!zoomToken || "error" in zoomToken) {
            dataStream.append({
              toolActivity: {
                step: "warning",
                tool: "scheduleMeeting",
                title: "Zoom Connection Required",
                description:
                  "Unable to create Zoom link. The meeting will be scheduled without Zoom.",
              },
            });
          } else {
            // Create Zoom meeting (mock implementation)
            zoomMeetingLink = `https://zoom.us/j/${Math.floor(
              100000000 + Math.random() * 900000000
            )}`;

            // Include Zoom link in the location if we have one
            if (zoomMeetingLink) {
              location = location
                ? `${location} | ${zoomMeetingLink}`
                : zoomMeetingLink;
            }
          }
        }

        // Update progress
        dataStream.append({
          toolActivity: {
            step: "processing",
            tool: "scheduleMeeting",
            title: "Creating Calendar Event",
            description: "Sending request to Google Calendar...",
          },
        });

        // Create calendar event (mock implementation)
        // In a real implementation, we would use the Google Calendar API
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Generate a meeting ID
        const meetingId = `meeting-${Math.random()
          .toString(36)
          .substring(2, 10)}`;
        const calendarLink = `https://calendar.google.com/calendar/event/${meetingId}`;

        // Final update showing success
        dataStream.append({
          toolActivity: {
            step: "complete",
            tool: "scheduleMeeting",
            title: "Meeting Scheduled",
            description: "Your meeting has been scheduled successfully!",
            fields: {
              Title: title,
              Date: new Date(startDateTime).toLocaleDateString(),
              Time: `${new Date(
                startDateTime
              ).toLocaleTimeString()} - ${new Date(
                endDateTime
              ).toLocaleTimeString()}`,
              Attendees: contacts.join(", "),
              "Calendar Link": calendarLink,
              ...(zoomMeetingLink && { "Zoom Link": zoomMeetingLink }),
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
            calendarLink,
            ...(zoomMeetingLink && { zoomMeetingLink }),
          },
        };
      } catch (error) {
        console.error("Error scheduling meeting:", error);

        // Show error in UI
        dataStream.append({
          toolActivity: {
            step: "error",
            tool: "scheduleMeeting",
            title: "Error Scheduling Meeting",
            description:
              error instanceof Error
                ? error.message
                : "Failed to schedule meeting",
          },
        });

        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to schedule meeting",
        };
      }
    },
  };
}
