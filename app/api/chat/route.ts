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

// Define the function schemas
const functions = [
  {
    name: "getCRMData",
    description: "Get customer information and deal history from the CRM",
    parameters: {
      type: "object",
      properties: {
        customerName: {
          type: "string",
          description: "The name of the customer to look up",
        },
      },
      required: ["customerName"],
    },
  },
  {
    name: "scheduleMeeting",
    description: "Schedule a meeting with contacts from the CRM",
    parameters: {
      type: "object",
      properties: {
        contacts: {
          type: "array",
          items: {
            type: "string",
          },
          description: "The email addresses of the contacts",
        },
        date: {
          type: "string",
          description: "The date for the meeting (YYYY-MM-DD)",
        },
        time: {
          type: "string",
          description: "The time for the meeting (HH:MM)",
        },
        duration: {
          type: "number",
          description: "The duration of the meeting in minutes",
        },
        title: {
          type: "string",
          description: "The title of the meeting",
        },
      },
      required: ["contacts", "date", "time", "duration", "title"],
    },
  },
  {
    name: "createZoomMeeting",
    description: "Create a Zoom meeting for a scheduled event",
    parameters: {
      type: "object",
      properties: {
        calendarEventId: {
          type: "string",
          description: "The ID of the calendar event",
        },
      },
      required: ["calendarEventId"],
    },
  },
  {
    name: "summarizeDeal",
    description: "Summarize deal status and save to Google Docs",
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
  const tokenData = await getGoogleCalendarToken(userId);

  if (!tokenData) {
    console.log("Using fallback data for scheduleMeeting.");
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
  return tokenData;
}

async function createZoomMeeting(params: any, userId: string) {
  const tokenData = await getZoomToken(userId);

  if (!tokenData) {
    console.log("Using fallback data for createZoomMeeting.");
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
  return tokenData;
}

async function summarizeDeal(params: any, userId: string) {
  const tokenData = await getGoogleDocsToken(userId);

  if (!tokenData) {
    console.log("Using fallback data for summarizeDeal.");
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
  return tokenData;
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
        date: z.string(),
        time: z.string(),
        duration: z.number(),
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
