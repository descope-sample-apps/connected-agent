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
import { format } from "date-fns";
import { mcpClient } from "@/lib/mcp-client";
import { parseRelativeDate, getCurrentDateContext } from "@/lib/date-utils";

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
      "Schedule a meeting with contacts. IMPORTANT: If the contact is mentioned by name (e.g., 'Shriki') or company (e.g., 'John from Acme Corp'), you MUST first use the getCRMData tool to look up their contact information. Only use email addresses directly if they are explicitly provided in email format (e.g., 'john@example.com'). For example, if someone says 'Schedule a meeting with Shriki', you should first look up Shriki's information in the CRM. But if they say 'Schedule a meeting with john@example.com', you can use that email directly.",
    parameters: {
      type: "object",
      properties: {
        contacts: {
          type: "array",
          items: {
            type: "string",
          },
          description:
            "The email addresses of the contacts to invite. IMPORTANT: Only use email addresses that were explicitly provided in email format. For contacts mentioned by name, first use getCRMData to look up their information.",
        },
        startDateTime: {
          type: "string",
          description:
            "The start date and time in ISO 8601 format (e.g., '2024-03-19T14:00:00Z'). Use the parseDate tool to convert natural language dates into this format.",
        },
        endDateTime: {
          type: "string",
          description:
            "The end date and time in ISO 8601 format (e.g., '2024-03-19T15:00:00Z'). Use the parseDate tool to convert natural language dates into this format.",
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
        user: "Schedule a meeting with Shriki",
        assistant:
          "I'll help you schedule a meeting with Shriki. First, I need to look up their contact information in the CRM.",
        function_call: {
          name: "getCRMData",
          arguments: {
            customerName: "Shriki",
          },
        },
      },
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
          name: "parseDate",
          arguments: {
            dateString: "tomorrow",
            timeString: "2:00 PM",
          },
        },
      },
      {
        user: "That looks good",
        assistant: "I'll schedule the meeting now.",
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
  {
    name: "connectToMCPServer",
    description:
      "Connect to an MCP server to use its tools. Use this when the user wants to connect to an external MCP server to use its tools. The server URL should be a valid URL.",
    parameters: {
      type: "object",
      properties: {
        serverUrl: {
          type: "string",
          description: "The URL of the MCP server to connect to",
        },
      },
      required: ["serverUrl"],
    },
    examples: [
      {
        user: "Connect to the MCP server at https://example.com/mcp",
        assistant: "I'll help you connect to the MCP server.",
        function_call: {
          name: "connectToMCPServer",
          arguments: {
            serverUrl: "https://example.com/mcp",
          },
        },
      },
    ],
  },
  {
    name: "executeMCPTool",
    description:
      "Execute a tool from a connected MCP server. Use this after connecting to an MCP server to use its tools. The tool name should match one of the tools available from the server.",
    parameters: {
      type: "object",
      properties: {
        toolName: {
          type: "string",
          description: "The name of the tool to execute",
        },
        parameters: {
          type: "object",
          description: "The parameters to pass to the tool",
        },
      },
      required: ["toolName", "parameters"],
    },
    examples: [
      {
        user: "Use the search tool from the MCP server",
        assistant: "I'll help you execute the search tool.",
        function_call: {
          name: "executeMCPTool",
          arguments: {
            toolName: "search",
            parameters: {
              query: "example search",
            },
          },
        },
      },
    ],
  },
  {
    name: "parseDate",
    description:
      "Parse a relative date and time into an ISO datetime string. Use this to convert natural language dates like 'tomorrow' or 'next week' into proper datetime values.",
    parameters: {
      type: "object",
      properties: {
        dateString: {
          type: "string",
          description: "The relative date string to parse",
        },
        timeString: {
          type: "string",
          description: "The relative time string to parse",
        },
      },
      required: ["dateString", "timeString"],
    },
    examples: [
      {
        user: "Parse 'tomorrow at 3pm'",
        assistant: "I'll parse the date and time.",
        function_call: {
          name: "parseDate",
          arguments: {
            dateString: "tomorrow",
            timeString: "3pm",
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
    // Parse the dates and ensure they use the current year
    const now = new Date();
    const currentYear = now.getFullYear();

    // Parse start date
    const startDate = new Date(params.startDateTime);
    if (startDate.getFullYear() < currentYear) {
      startDate.setFullYear(currentYear);
    }

    // Parse end date
    const endDate = new Date(params.endDateTime);
    if (endDate.getFullYear() < currentYear) {
      endDate.setFullYear(currentYear);
    }

    console.log(`[scheduleMeeting] Using dates:`, {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    });

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
            dateTime: startDate.toISOString(),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
          end: {
            dateTime: endDate.toISOString(),
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
    connectToMCPServer: {
      description: "Connect to an MCP server to use its tools",
      parameters: z.object({
        serverUrl: z.string().url(),
      }),
      execute: async ({ serverUrl }: any) => {
        try {
          const connection = await mcpClient.connectToServer(
            serverUrl,
            userId!
          );
          return {
            success: true,
            message: `Successfully connected to MCP server at ${serverUrl}`,
            tools: connection.tools,
          };
        } catch (error) {
          console.error("Failed to connect to MCP server:", error);
          throw error;
        }
      },
    },
    executeMCPTool: {
      description: "Execute a tool from a connected MCP server",
      parameters: z.object({
        toolName: z.string(),
        parameters: z.record(z.any()),
      }),
      execute: async ({ toolName, parameters }: any) => {
        try {
          const result = await mcpClient.executeTool(
            userId!,
            toolName,
            parameters
          );
          return {
            success: true,
            result,
          };
        } catch (error) {
          console.error("Failed to execute MCP tool:", error);
          throw error;
        }
      },
    },
    parseDate: {
      description:
        "Parse a relative date and time into an ISO datetime string. Use this to convert natural language dates like 'tomorrow' or 'next week' into proper datetime values.",
      parameters: z.object({
        dateString: z.string(),
        timeString: z.string(),
      }),
      execute: async ({ dateString, timeString }: any) => {
        const dateContext = getCurrentDateContext();
        const parsedDate = parseRelativeDate(dateString, timeString);

        return {
          success: true,
          dateContext,
          parsedDate,
        };
      },
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
