import { Tool, ToolConfig, ToolResponse, toolRegistry } from "./base";
import { getOAuthTokenWithScopeValidation } from "../oauth-utils";
import { google } from "googleapis";
import { getRequiredScopes } from "@/lib/openapi-utils";
import { getCurrentDateContext } from "@/lib/date-utils";

export interface AddGoogleMeetInput {
  eventId?: string;
  eventTitle?: string;
  eventDate?: string;
  attendee?: string;
}

export class AddGoogleMeetToEventTool extends Tool<AddGoogleMeetInput> {
  config: ToolConfig = {
    id: "add-google-meet",
    name: "Add Google Meet",
    description: "Add a Google Meet link to an existing calendar event",
    scopes: [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/meetings.space.created",
    ],
    requiredFields: [],
    optionalFields: ["eventId", "eventTitle", "eventDate", "attendee"],
    capabilities: [
      "Adds Google Meet to existing calendar events",
      "Finds calendar events by title, date, or attendee",
      "Updates existing events with video conferencing details",
    ],
  };

  validate(data: AddGoogleMeetInput): ToolResponse | null {
    // Require at least one search parameter to find the event
    if (
      !data.eventId &&
      !data.eventTitle &&
      !data.eventDate &&
      !data.attendee
    ) {
      return {
        success: false,
        error: "Missing event identification",
        needsInput: {
          field: "eventTitle",
          message:
            "Please provide an event title or ID to identify the calendar event",
        },
      };
    }

    return null;
  }

  async execute(
    userId: string,
    data: AddGoogleMeetInput
  ): Promise<ToolResponse> {
    try {
      const dateContext = getCurrentDateContext();
      console.log("Adding Google Meet to calendar event:", {
        eventId: data.eventId,
        eventTitle: data.eventTitle,
        eventDate: data.eventDate,
        attendee: data.attendee,
        currentDate: dateContext.currentDate,
      });

      // Get OAuth token for Google Calendar
      const tokenResponse = await getOAuthTokenWithScopeValidation(
        userId,
        "google-meet", // Using google-calendar as the primary token source
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
          error: "Google Calendar access required",
          ui: {
            type: "connection_required",
            service: "google-calendar",
            message: "Google Calendar access is required to modify events",
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
        access_token: tokenResponse.token?.accessToken,
      });
      const calendar = google.calendar({ version: "v3", auth: oauth2Client });

      // Step 1: Find the event if eventId is not provided
      let eventId = data.eventId;
      let foundEvent = null;

      if (!eventId) {
        // Search for the event based on other criteria
        const timeMin = data.eventDate
          ? new Date(data.eventDate).toISOString()
          : new Date().toISOString();

        // Set timeMax to 1 year in the future if not specified
        const timeMax = data.eventDate
          ? new Date(
              new Date(data.eventDate).getTime() + 7 * 24 * 60 * 60 * 1000
            ).toISOString() // 1 week from event date
          : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(); // 1 year from now

        const q = data.eventTitle || "";

        // Search for events
        const searchResponse = await calendar.events.list({
          calendarId: "primary",
          timeMin,
          timeMax,
          q,
          singleEvents: true,
          orderBy: "startTime",
          maxResults: 10,
        });

        const events = searchResponse.data.items || [];

        if (events.length === 0) {
          return {
            success: false,
            error: "Event not found",
            ui: {
              type: "error",
              message: `No calendar events found matching your criteria. Please check the event details.`,
            },
          };
        }

        // Find the most relevant event
        // If we have an attendee parameter, prioritize events with that attendee
        if (data.attendee) {
          foundEvent = events.find((event) =>
            event.attendees?.some((a) =>
              a.email?.toLowerCase().includes(data.attendee!.toLowerCase())
            )
          );
        }

        // If no event was found with the attendee, or no attendee was specified,
        // use the first event that matches the title (if provided)
        if (!foundEvent && data.eventTitle) {
          foundEvent = events.find((event) =>
            event.summary
              ?.toLowerCase()
              .includes(data.eventTitle!.toLowerCase())
          );
        }

        // If still no event found, just use the first event
        if (!foundEvent && events.length > 0) {
          foundEvent = events[0];
        }

        if (!foundEvent) {
          return {
            success: false,
            error: "Event not found",
            ui: {
              type: "error",
              message: `No calendar events found matching your criteria. Please check the event details.`,
            },
          };
        }

        eventId = foundEvent.id!;
      } else {
        // Get the event by ID
        try {
          const eventResponse = await calendar.events.get({
            calendarId: "primary",
            eventId: eventId,
          });
          foundEvent = eventResponse.data;
        } catch (error) {
          return {
            success: false,
            error: "Event not found",
            ui: {
              type: "error",
              message: `The specified calendar event ID was not found. Please check the event details.`,
            },
          };
        }
      }

      // Step 2: Check if the event already has a Google Meet link
      if (
        foundEvent?.conferenceData?.entryPoints?.some(
          (ep) => ep.entryPointType === "video"
        )
      ) {
        const meetLink = foundEvent.conferenceData.entryPoints.find(
          (ep) => ep.entryPointType === "video"
        )?.uri;

        return {
          success: true,
          data: {
            eventId: foundEvent.id,
            eventTitle: foundEvent.summary,
            eventStartTime:
              foundEvent.start?.dateTime || foundEvent.start?.date,
            conferenceLink: meetLink,
            message: `This event already has a Google Meet link: ${meetLink}`,
            formattedMessage: `Event "${foundEvent.summary}" already has a Google Meet link: [Join Google Meet](${meetLink})`,
          },
        };
      }

      // Step 3: Add Google Meet to the event
      // Prepare event data with conferenceData
      const updatedEvent = {
        ...foundEvent,
        conferenceData: {
          createRequest: {
            requestId: `meet-${Date.now()}`,
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
      };

      // Update the calendar event with Google Meet
      const updateResponse = await calendar.events.update({
        calendarId: "primary",
        eventId: eventId,
        requestBody: updatedEvent,
        conferenceDataVersion: 1,
        sendUpdates: "all", // Notify attendees about the update
      });

      // Extract Meet link from the response
      const meetLink = updateResponse.data.conferenceData?.entryPoints?.find(
        (entry) => entry.entryPointType === "video"
      )?.uri;

      // Format date for display
      const startDate = new Date(updateResponse.data.start?.dateTime || "");
      const formattedDate = startDate.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const formattedTime = startDate.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });

      // Create formatted message with attendees if available
      let attendeesList = "";
      if (
        updateResponse.data.attendees &&
        updateResponse.data.attendees.length > 0
      ) {
        const attendeeNames = updateResponse.data.attendees
          .map((a) => a.displayName || a.email)
          .filter(Boolean);

        if (attendeeNames.length > 0) {
          attendeesList = `\nAttendees: ${attendeeNames.join(", ")}`;
        }
      }

      return {
        success: true,
        data: {
          eventId: updateResponse.data.id,
          eventTitle: updateResponse.data.summary,
          eventStartTime: updateResponse.data.start?.dateTime,
          eventEndTime: updateResponse.data.end?.dateTime,
          conferenceLink: meetLink,
          formattedMessage: `Google Meet link added to "${updateResponse.data.summary}" on ${formattedDate} at ${formattedTime}.${attendeesList}\n\n[Join Google Meet](${meetLink})`,
        },
      };
    } catch (error) {
      console.error("Error adding Google Meet to calendar event:", error);

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
          error: "Insufficient permissions to add Google Meet",
          ui: {
            type: "connection_required",
            service: "google-calendar",
            message:
              "You need additional permissions to add Google Meet to calendar events. Please reconnect with the required scopes.",
            requiredScopes: requiredScopes,
            connectButton: {
              text: "Reconnect Google Calendar",
              action: "connection://google-calendar",
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
            : "Failed to add Google Meet to event",
        ui: {
          type: "error",
          message:
            "There was an error adding Google Meet to your calendar event. Please try again later.",
        },
      };
    }
  }
}

// Create and export an instance of the tool
export const addGoogleMeetTool = new AddGoogleMeetToEventTool();

// Register the Add Google Meet to Event tool
toolRegistry.register(addGoogleMeetTool);
