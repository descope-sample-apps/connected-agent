import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";
import type { ToolSet } from "ai";
import {
  getGoogleCalendarToken,
  getGoogleContactsToken,
  getZoomToken,
} from "@/lib/descope";
import { session } from "@descope/nextjs-sdk/server";

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

// Convert the function definitions to the correct ToolSet format
const toolSet: ToolSet = {};
for (const fn of functions) {
  toolSet[fn.name] = {
    type: "function",
    function: fn,
  };
}

// Mock function implementations with OAuth token retrieval
async function getCRMData(params: any, userId: string) {
  try {
    // Try to get OAuth token
    const tokenData = await getGoogleContactsToken(userId);
    console.log("Retrieved Google Contacts token:", tokenData.accessToken);

    // In a real app, you'd use this token to call external APIs
  } catch (error) {
    console.log(
      "Could not retrieve Google Contacts token, using fallback data"
    );
    // Continue with fallback - don't throw the error
  }

  // Always return mock data (either as fallback or for demo purposes)
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
        notes:
          "Initial discovery call. Customer expressed interest in our enterprise solution.",
      },
      {
        date: "2025-03-05",
        type: "Email",
        notes:
          "Sent follow-up with product specifications and pricing options.",
      },
      {
        date: "2025-03-20",
        type: "Meeting",
        notes: "Product demo with technical team. Positive feedback received.",
      },
    ],
  };
}

async function scheduleMeeting(params: any, userId: string) {
  try {
    // Try to get OAuth token
    const tokenData = await getGoogleCalendarToken(userId);
    console.log("Retrieved Google Calendar token:", tokenData.accessToken);

    // In a real app, you'd use this token to call Google Calendar API
  } catch (error) {
    console.log(
      "Could not retrieve Google Calendar token, using fallback data"
    );
    // Continue with fallback - don't throw the error
  }

  // Always return mock data
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

async function createZoomMeeting(params: any, userId: string) {
  try {
    // Try to get OAuth token
    const tokenData = await getZoomToken(userId);
    console.log("Retrieved Zoom token:", tokenData.accessToken);

    // In a real app, you'd use this token to call Zoom API
  } catch (error) {
    console.log("Could not retrieve Zoom token, using fallback data");
    // Continue with fallback - don't throw the error
  }

  // Always return mock data
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

async function summarizeDeal(params: any, userId: string) {
  try {
    // In a real app, you'd validate the token here
    // For now, we'll just proceed to the mock data
  } catch (error) {
    console.log("Error with token validation, using fallback data");
    // Continue with fallback - don't throw the error
  }

  // Always return mock data
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

export async function POST(req: Request) {
  const { messages } = await req.json();

  let userId: string | undefined;
  try {
    const userSession = await session();
    userId = userSession?.token?.sub;
    console.log(
      "Processing chat request, authenticated user:",
      userId ? "Yes" : "No"
    );
  } catch (error) {
    console.warn("Session retrieval error:", error);
    // Continue with userId undefined - functions will use fallback data
  }

  console.log(
    "Processing chat request, authenticated user:",
    userId ? "Yes" : "No"
  );

  // Function to handle tool function calls
  const handleFunctionCall = async (name: string, args: any) => {
    console.log(`Calling function: ${name} with args:`, args);

    if (
      [
        "getCRMData",
        "scheduleMeeting",
        "createZoomMeeting",
        "summarizeDeal",
      ].includes(name) &&
      !userId
    ) {
      console.error("Authentication required but user not authenticated");
      return { error: "Authentication required for this action" };
    }

    try {
      switch (name) {
        case "getCRMData":
          return await getCRMData(args, userId!);
        case "scheduleMeeting":
          return await scheduleMeeting(args, userId!);
        case "createZoomMeeting":
          return await createZoomMeeting(args, userId!);
        case "summarizeDeal":
          return await summarizeDeal(args, userId!);
        default:
          console.error(`Unknown function: ${name}`);
          return { error: `Unknown function: ${name}` };
      }
    } catch (error) {
      console.error(`Error executing function ${name}:`, error);
      return {
        error: `Error executing ${name}`,
        details: error instanceof Error ? error.message : String(error),
      };
    }
  };

  // Check the last message to see if it might need tools
  const lastMessage =
    messages.length > 0 ? messages[messages.length - 1] : null;
  const mightNeedTools =
    !!lastMessage &&
    lastMessage.role === "user" &&
    [
      "schedule",
      "meeting",
      "customer",
      "crm",
      "zoom",
      "deal",
      "summary",
      "look up",
      "calendar",
      "tools",
      "google docs",
    ].some((keyword) => lastMessage.content.toLowerCase().includes(keyword));

  // Create the stream with or without tools based on message content
  console.log(
    "Message might need tools:",
    mightNeedTools,
    lastMessage?.content
  );

  let streamOptions;
  if (mightNeedTools) {
    streamOptions = {
      model: openai("gpt-3.5-turbo"),
      messages,
      tools: toolSet,
      toolChoice: "auto",
      async onToolCall(toolCall) {
        const { name, arguments: args } = toolCall;
        console.log(`Tool called: ${name} with args:`, args);

        try {
          const result = await handleFunctionCall(name, args);
          return { output: JSON.stringify(result) };
        } catch (error) {
          console.error(`Error in tool call ${name}:`, error);
          return {
            output: JSON.stringify({
              error: `Error executing ${name}`,
              details: error instanceof Error ? error.message : String(error),
            }),
          };
        }
      },
    };
  } else {
    streamOptions = {
      model: openai("gpt-3.5-turbo"),
      messages,
    };
  }

  try {
    const result = streamText(streamOptions);
    return result.toDataStreamResponse();
  } catch (streamError) {
    console.error("Error in stream creation:", streamError);
    return new Response(
      JSON.stringify({
        error: "Stream creation failed",
        details:
          streamError instanceof Error
            ? streamError.message
            : String(streamError),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
