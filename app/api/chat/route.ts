import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";
import type { ToolSet } from "ai";
import {
  getGoogleCalendarToken,
  getCRMToken,
  getZoomToken,
  getGoogleDocsToken,
} from "@/lib/descope";
import { session } from "@descope/nextjs-sdk/server";
import { z } from "zod";
import { storeToolAction } from "@/lib/server-storage";
import { addDays, format, parse, parseISO } from "date-fns";

interface CalendarEvent {
  id: string;
  summary: string;
  start: {
    dateTime: string;
  };
  end: {
    dateTime: string;
  };
  attendees?: Array<{
    email: string;
  }>;
  htmlLink: string;
}

// Define the function schemas
const functions = [
  {
    name: "getCRMData",
    description:
      "Get customer information and deal history from the CRM. Only use this when you need to look up customer details, deal information, or company information. Do NOT use this when you already have the contact's email address or when scheduling a meeting with a known contact. For example, if someone says 'Schedule a meeting with John from Acme Corp' and you don't have John's email, use this to look up Acme Corp's information. But if someone says 'Schedule a meeting with john@example.com', you can use that email directly without looking up the CRM.",
    parameters: {
      type: "object",
      properties: {
        customerName: {
          type: "string",
          description: "The name of the customer or company to look up",
        },
      },
      required: ["customerName"],
    },
    examples: [
      {
        user: "Tell me about Acme Corp",
        assistant: "I'll look up information about Acme Corp in the CRM.",
        function_call: {
          name: "getCRMData",
          arguments: { customerName: "Acme Corp" },
        },
      },
      {
        user: "Schedule a meeting with John from Acme Corp",
        assistant:
          "I'll look up Acme Corp's information to find John's contact details.",
        function_call: {
          name: "getCRMData",
          arguments: { customerName: "Acme Corp" },
        },
      },
      {
        user: "Schedule a meeting with john@example.com",
        assistant:
          "I'll help you schedule a meeting with John. When would you like to have this meeting?",
        function_call: null,
      },
    ],
  },
  {
    name: "scheduleMeeting",
    description:
      "Schedule a meeting with contacts. You can use this directly with email addresses - no need to look up the CRM if you already have the contact's email. For example, if someone says 'Schedule a meeting with john@example.com', you can use that email directly. Only use the CRM tool if you need to look up contact information for someone mentioned by name or company. When handling dates, always use the current year unless explicitly specified otherwise. For example, 'tomorrow at 3pm' should use the current year, not 2023.",
    parameters: {
      type: "object",
      properties: {
        contacts: {
          type: "array",
          items: {
            type: "string",
          },
          description:
            "The email addresses of the contacts to invite. You can use these directly if provided, no need to look up the CRM.",
        },
        startDateTime: {
          type: "string",
          description:
            "The start date and time in ISO 8601 format (e.g., '2024-03-19T14:00:00Z'). When converting natural language dates, always use the current year unless explicitly specified otherwise.",
        },
        endDateTime: {
          type: "string",
          description:
            "The end date and time in ISO 8601 format (e.g., '2024-03-19T15:00:00Z'). When converting natural language dates, always use the current year unless explicitly specified otherwise.",
        },
        title: {
          type: "string",
          description: "The title or subject of the meeting",
        },
      },
      required: ["contacts", "startDateTime", "endDateTime", "title"],
    },
    examples: [
      {
        user: "Schedule a meeting with john@example.com",
        assistant:
          "I'll help you schedule a meeting with John. When would you like to have this meeting?",
        function_call: null,
      },
      {
        user: "Tomorrow at 2 PM",
        assistant: "Great! How long would you like the meeting to be?",
        function_call: null,
      },
      {
        user: "1 hour",
        assistant:
          "Perfect! I'll schedule a 1-hour meeting with John for tomorrow at 2 PM.",
        function_call: {
          name: "scheduleMeeting",
          arguments: {
            contacts: ["john@example.com"],
            startDateTime: "2024-03-19T14:00:00Z",
            endDateTime: "2024-03-19T15:00:00Z",
            title: "Meeting with John",
          },
        },
      },
    ],
  },
  {
    name: "createZoomMeeting",
    description:
      "Create a Zoom meeting for a scheduled event. If the user mentions wanting to add a Zoom meeting but hasn't scheduled the calendar event yet, help them schedule the calendar event first.",
    parameters: {
      type: "object",
      properties: {
        calendarEventId: {
          type: "string",
          description:
            "The ID of the calendar event to add the Zoom meeting to",
        },
      },
      required: ["calendarEventId"],
    },
    examples: [
      {
        user: "Add a Zoom meeting to my meeting with John",
        assistant:
          "I'll help you add a Zoom meeting. First, I'll need to check if we have a calendar event scheduled for your meeting with John.",
        function_call: null,
      },
    ],
  },
  {
    name: "summarizeDeal",
    description:
      "Summarize deal status and save to Google Docs. If the user mentions wanting a summary but doesn't specify which deal, ask them which deal they'd like to summarize.",
    parameters: {
      type: "object",
      properties: {
        dealId: {
          type: "string",
          description: "The ID of the deal to summarize",
        },
        includeHistory: {
          type: "boolean",
          description: "Whether to include the full history in the summary",
        },
      },
      required: ["dealId"],
    },
    examples: [
      {
        user: "Create a summary of the Acme Corp deal",
        assistant:
          "I'll help you create a summary. Would you like me to include the full history of the deal in the summary?",
        function_call: null,
      },
      {
        user: "Yes, please include the history",
        assistant:
          "I'll create a comprehensive summary of the Acme Corp deal including its full history.",
        function_call: {
          name: "summarizeDeal",
          arguments: {
            dealId: "deal-123",
            includeHistory: true,
          },
        },
      },
    ],
  },
];

// Convert to a ToolSet object with string keys
const toolSet: ToolSet = Object.fromEntries(
  functions.map((fn) => [
    fn.name,
    {
      type: "function" as const,
      function: fn,
      parameters: fn.parameters,
      description: fn.description,
    },
  ])
);

// Mock function implementations with OAuth token retrieval
async function getCRMData(params: any, userId: string) {
  const tokenData = await getCRMToken(userId);

  if (!tokenData) {
    console.log("Using fallback data for getCRMData.");
    return {
      customer: {
        name: params.customerName || "Acme Corp",
        contactEmail: "john.doe@acmecorp.com",
        phone: "555-123-4567",
        status: "Qualified Lead",
      },
      deal: {
        id: "deal-123",
        value: "$50,000",
        stage: "Proposal",
        probability: "70%",
        expectedCloseDate: "2025-05-15",
      },
      history: [
        {
          date: "2025-02-10",
          type: "Meeting",
          notes: "Initial discovery call.",
        },
        { date: "2025-03-05", type: "Email", notes: "Sent follow-up email." },
        { date: "2025-03-20", type: "Meeting", notes: "Product demo." },
      ],
    };
  }
  return tokenData;
}

async function scheduleMeeting(params: any, userId: string) {
  console.log(`[scheduleMeeting] Starting with params:`, params);
  const tokenData = await getGoogleCalendarToken(userId);

  if (!tokenData || "error" in tokenData) {
    console.log(
      "[scheduleMeeting] Using fallback data due to missing/invalid token"
    );
    return {
      success: true,
      meeting: {
        id: "cal-event-456",
        title: params.title || "Follow-up Meeting",
        date: params.date || "2025-04-10",
        time: params.time || "14:00",
        duration: params.duration || 60,
        attendees: params.contacts || ["john.doe@acmecorp.com"],
        link: "https://calendar.google.com/event?id=123456",
      },
    };
  }

  try {
    // Make the actual API call to Google Calendar
    const response = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenData.token.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          summary: params.title,
          start: {
            dateTime: params.startDateTime,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
          end: {
            dateTime: params.endDateTime,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
          attendees: params.contacts.map((email: string) => ({ email })),
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[scheduleMeeting] API Error:`, {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
      throw new Error(
        `Failed to create calendar event: ${response.statusText}`
      );
    }

    const event: CalendarEvent = await response.json();
    console.log(`[scheduleMeeting] Successfully created event:`, {
      id: event.id,
      title: event.summary,
      link: event.htmlLink,
      attendees: event.attendees,
    });

    storeToolAction(userId, {
      success: true,
      action: "schedule_meeting",
      provider: "google-calendar",
      details: {
        title: event.summary,
        startTime: event.start.dateTime,
        endTime: event.end.dateTime,
        attendees: event.attendees?.map((a) => a.email) || [],
        meetingUrl: event.htmlLink,
      },
      timestamp: new Date().toISOString(),
    });

    // Format the response in a more user-friendly way
    const startDate = new Date(event.start.dateTime);
    const formattedDate = format(startDate, "MMMM d, yyyy");
    const formattedTime = format(startDate, "h:mm a");
    const attendeeList = event.attendees?.map((a) => a.email).join(", ") || "";

    return {
      success: true,
      message: `I've scheduled a meeting with ${attendeeList} for ${formattedDate} at ${formattedTime}.`,
      meeting: {
        title: event.summary,
        date: formattedDate,
        time: formattedTime,
        attendees: event.attendees?.map((a) => a.email) || [],
        link: event.htmlLink,
        linkText: "View Meeting Details",
      },
      type: "meeting_scheduled",
      ui: {
        type: "meeting_scheduled",
        message: `I've scheduled a meeting with ${attendeeList} for ${formattedDate} at ${formattedTime}.`,
        link: {
          text: "View Meeting Details",
          url: event.htmlLink,
        },
        details: {
          title: event.summary,
          date: formattedDate,
          time: formattedTime,
          attendees: event.attendees?.map((a) => a.email) || [],
        },
      },
    };
  } catch (error) {
    console.error(`[scheduleMeeting] Error:`, error);
    storeToolAction(userId, {
      success: false,
      action: "schedule_meeting",
      provider: "google-calendar",
      details: {
        error:
          error instanceof Error ? error.message : "Failed to schedule meeting",
      },
      timestamp: new Date().toISOString(),
    });
    throw error;
  }
}

async function createZoomMeeting(params: any, userId: string) {
  console.log(`[createZoomMeeting] Starting with params:`, params);
  const tokenData = await getZoomToken(userId);

  if (!tokenData || "error" in tokenData) {
    console.log(
      "[createZoomMeeting] Using fallback data due to missing/invalid token"
    );
    return {
      success: true,
      zoomMeeting: {
        id: "zoom-789",
        link: "https://zoom.us/j/123456789",
        password: "123456",
        calendarEventId: params.calendarEventId || "cal-event-456",
      },
    };
  }

  try {
    console.log(
      `[createZoomMeeting] Creating Zoom meeting for calendar event:`,
      params.calendarEventId
    );

    // Make the actual API call to Zoom
    const response = await fetch("https://api.zoom.us/v2/users/me/meetings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenData.token.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        topic: "Meeting",
        type: 2, // Scheduled meeting
        start_time: new Date().toISOString(), // You might want to get this from the calendar event
        duration: 60, // Default duration
        settings: {
          host_video: true,
          participant_video: true,
          join_before_host: false,
          waiting_room: true,
          meeting_authentication: true,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[createZoomMeeting] API Error:`, {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
      throw new Error(`Failed to create Zoom meeting: ${response.statusText}`);
    }

    const zoomMeeting = await response.json();
    console.log(`[createZoomMeeting] Successfully created meeting:`, {
      id: zoomMeeting.id,
      joinUrl: zoomMeeting.join_url,
      password: zoomMeeting.password,
    });

    storeToolAction(userId, {
      success: true,
      action: "create_zoom_meeting",
      provider: "zoom",
      details: {
        title: "Zoom Meeting",
        meetingUrl: zoomMeeting.join_url,
        meetingId: zoomMeeting.id.toString(),
        eventId: params.calendarEventId,
      },
      timestamp: new Date().toISOString(),
    });

    return zoomMeeting;
  } catch (error) {
    console.error(`[createZoomMeeting] Error:`, error);
    storeToolAction(userId, {
      success: false,
      action: "create_zoom_meeting",
      provider: "zoom",
      details: {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create Zoom meeting",
      },
      timestamp: new Date().toISOString(),
    });
    throw error;
  }
}

async function summarizeDeal(params: any, userId: string) {
  console.log(`[summarizeDeal] Starting with params:`, params);
  const tokenData = await getGoogleDocsToken(userId);

  if (!tokenData || "error" in tokenData) {
    console.log(
      "[summarizeDeal] Using fallback data due to missing/invalid token"
    );
    return {
      success: true,
      document: {
        id: "doc-101112",
        title: "Deal Summary - Acme Corp",
        link: "https://docs.google.com/document/d/123456",
        createdAt: new Date().toISOString(),
      },
      dealSummary: {
        id: params.dealId || "deal-123",
        customer: "Acme Corp",
        value: "$50,000",
        stage: "Proposal",
        probability: "70%",
        expectedCloseDate: "2025-05-15",
        nextSteps: "Schedule technical review with IT department",
      },
    };
  }

  try {
    console.log(`[summarizeDeal] Creating document for deal:`, params.dealId);

    // Make the actual API call to Google Docs
    const response = await fetch("https://docs.googleapis.com/v1/documents", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenData.token.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: `Deal Summary - ${params.dealId}`,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[summarizeDeal] API Error:`, {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
      throw new Error(`Failed to create document: ${response.statusText}`);
    }

    const document = await response.json();
    console.log(`[summarizeDeal] Successfully created document:`, {
      id: document.documentId,
      title: document.title,
      link: `https://docs.google.com/document/d/${document.documentId}`,
    });

    storeToolAction(userId, {
      success: true,
      action: "create_document",
      provider: "google-docs",
      details: {
        title: document.title,
        documentId: document.documentId,
        documentTitle: document.title,
        link: `https://docs.google.com/document/d/${document.documentId}`,
      },
      timestamp: new Date().toISOString(),
    });

    return document;
  } catch (error) {
    console.error(`[summarizeDeal] Error:`, error);
    storeToolAction(userId, {
      success: false,
      action: "create_document",
      provider: "google-docs",
      details: {
        error:
          error instanceof Error ? error.message : "Failed to create document",
      },
      timestamp: new Date().toISOString(),
    });
    throw error;
  }
}

export async function POST(req: Request) {
  // In case auto-tooling doesn't work, we can use this to check if the message might need tools
  // const mightNeedTools =
  //   !!lastMessage &&
  //   [
  //     "schedule",
  //     "meeting",
  //     "customer",
  //     "crm",
  //     "zoom",
  //     "deal",
  //     "summary",
  //     "look up",
  //     "calendar",
  //     "tools",
  //     "google docs",
  //   ].some((keyword) => lastMessage.content.toLowerCase().includes(keyword));

  // Create the stream with or without tools based on message content
  // console.log(
  //   "Message might need tools:",
  //   mightNeedTools,
  //   lastMessage?.content
  // );

  const { messages } = await req.json();

  let userId: string | undefined;
  try {
    const userSession = await session();
    userId = userSession?.token?.sub;
    console.log("Authenticated user:", userId ? "Yes" : "No");
  } catch (error) {
    console.warn("Session retrieval error:", error);
  }

  const tools = {
    getCRMData: {
      description: "Get customer information and deal history from the CRM",
      parameters: z.object({ customerName: z.string() }),
      execute: async ({ customerName }: any) =>
        await getCRMData({ customerName }, userId!),
    },
    scheduleMeeting: {
      description: "Schedule a meeting with contacts from the CRM",
      parameters: z.object({
        contacts: z.array(z.string()),
        startDateTime: z.string(),
        endDateTime: z.string(),
        title: z.string(),
      }),
      execute: async (params: any) => await scheduleMeeting(params, userId!),
    },
    createZoomMeeting: {
      description: "Create a Zoom meeting for a scheduled event",
      parameters: z.object({ calendarEventId: z.string() }),
      execute: async (params: any) => await createZoomMeeting(params, userId!),
    },
    summarizeDeal: {
      description: "Summarize deal status and save to Google Docs",
      parameters: z.object({
        dealId: z.string(),
        includeHistory: z.boolean(),
      }),
      execute: async (params: any) => await summarizeDeal(params, userId!),
    },
  };

  try {
    const result = await streamText({
      model: openai("gpt-3.5-turbo"),
      tools,
      toolChoice: "auto",
      maxSteps: 10,
      prompt: messages[messages.length - 1].content,
    });

    // Return the stream directly
    return result.toDataStreamResponse();
  } catch (error: any) {
    console.error("Error generating text:", error);
    return new Response(
      JSON.stringify({ error: "An error occurred", details: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
