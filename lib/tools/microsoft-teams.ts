import {
  Tool,
  ToolConfig,
  ToolResponse,
  toolRegistry,
  createConnectionRequest,
} from "./base";
import { getOAuthTokenWithScopeValidation } from "../oauth-utils";
import { getCurrentDateContext } from "@/lib/date-utils";

export interface TeamsEvent {
  title: string;
  description?: string;
  startTime: string;
  duration: number;
  attendees?: string[];
  timeZone?: string;
  settings?: {
    chatType?: "group" | "oneOnOne" | "meeting";
    allowNewTimeProposals?: boolean;
  };
}

export class TeamsChatTool extends Tool<TeamsEvent> {
  config: ToolConfig = {
    id: "microsoft-teams",
    name: "Microsoft Teams",
    description: "Create Microsoft Teams chats and send messages",
    scopes: [
      "ChannelMember.ReadWrite.All",
      "ChannelMessage.Send",
      "Chat.ReadWrite.All",
      "ChatMessage.Send",
      "offline_access",
    ],
    requiredFields: ["title", "startTime", "duration"],
    optionalFields: ["description", "attendees", "timeZone", "settings"],
    capabilities: [
      "Create Microsoft Teams meetings",
      "Generate Teams meeting links",
      "Schedule video conferences",
      "Manage meeting settings",
    ],
    oauthConfig: {
      provider: "microsoft-teams",
      defaultScopes: [
        "ChannelMember.ReadWrite.All",
        "ChannelMessage.Send",
        "Chat.ReadWrite.All",
        "ChatMessage.Send",
        "offline_access",
      ],
    },
  };

  validate(data: TeamsEvent): ToolResponse | null {
    // Get current date context for validation
    const dateContext = getCurrentDateContext();

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
          message: `Please provide a start time. Today is ${dateContext.currentDate}.`,
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

  async execute(userId: string, data: TeamsEvent): Promise<ToolResponse> {
    try {
      // Include date context when processing
      const dateContext = getCurrentDateContext();
      console.log("Creating Microsoft Teams meeting:", {
        title: data.title,
        startTime: data.startTime,
        duration: data.duration,
        currentDate: dateContext.currentDate,
      });

      // Get OAuth token for Microsoft Graph API
      const tokenResponse = await getOAuthTokenWithScopeValidation(
        userId,
        "microsoft-teams",
        {
          appId: "microsoft-teams",
          userId,
          scopes: this.config.scopes,
          operation: "tool_calling",
        }
      );

      if (!tokenResponse || "error" in tokenResponse) {
        // Extract scope information if available
        const requiredScopes =
          "requiredScopes" in tokenResponse
            ? tokenResponse.requiredScopes
            : this.config.scopes;
        const currentScopes =
          "currentScopes" in tokenResponse
            ? tokenResponse.currentScopes
            : undefined;

        // Use standardized connection request
        return createConnectionRequest({
          provider: "microsoft-teams",
          isReconnect: currentScopes && currentScopes.length > 0,
          requiredScopes: requiredScopes,
          currentScopes: currentScopes,
          customMessage:
            "Please connect your Microsoft account to create Teams meetings",
        });
      }

      // Extract the access token
      const accessToken = tokenResponse.token?.accessToken;

      // Calculate end time from duration
      const startTime = new Date(data.startTime);
      const endTime = new Date(startTime.getTime() + data.duration * 60000);

      // First, create a chat with all the attendees
      const attendeesList = data.attendees || [];

      // Create chat members array for the API request
      const chatMembers = attendeesList.map((email) => ({
        "@odata.type": "#microsoft.graph.aadUserConversationMember",
        roles: ["owner"],
        "user@odata.bind": `https://graph.microsoft.com/v1.0/users('${email}')`,
      }));

      // Create the chat
      const chatPayload = {
        chatType: "group",
        topic: data.title,
        members: chatMembers,
      };

      // Create a chat using Microsoft Graph API
      const chatResponse = await fetch(
        "https://graph.microsoft.com/v1.0/chats",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(chatPayload),
        }
      );

      if (!chatResponse.ok) {
        const errorData = await chatResponse.json();
        console.error("Microsoft Graph API error creating chat:", errorData);

        // Check if this is a scope or permission error
        if (chatResponse.status === 401 || chatResponse.status === 403) {
          return createConnectionRequest({
            provider: "microsoft-teams",
            isReconnect: true,
            requiredScopes: this.config.scopes,
            customMessage:
              "You need additional permissions to create Teams chats. Please reconnect with the required scopes.",
          });
        }

        throw new Error(
          `Failed to create Teams chat: ${
            errorData.error?.message || chatResponse.statusText
          }`
        );
      }

      const chatData = await chatResponse.json();
      const chatId = chatData.id;

      // Now send a message to the chat with meeting details
      const messageContent = `
<strong>${data.title}</strong>
<p>${data.description || ""}</p>
<p>Start: ${startTime.toLocaleString()}</p>
<p>End: ${endTime.toLocaleString()}</p>
<p>Duration: ${data.duration} minutes</p>
`;

      // Send a message to the chat
      const messagePayload = {
        body: {
          contentType: "html",
          content: messageContent,
        },
      };

      const messageResponse = await fetch(
        `https://graph.microsoft.com/v1.0/chats/${chatId}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(messagePayload),
        }
      );

      if (!messageResponse.ok) {
        const errorData = await messageResponse.json();
        console.error("Microsoft Graph API error sending message:", errorData);

        // We'll still continue since at least the chat was created
        console.warn("Failed to send initial message to Teams chat");
      }

      // Get chat webUrl
      const chatUrl = chatData.webUrl;

      return {
        success: true,
        data: {
          chatId: chatId,
          joinUrl: chatUrl,
          formattedMessage: `Microsoft Teams chat "${data.title}" created successfully! Join here: [Join Teams Chat](${chatUrl})`,
          meetingInfo: {
            topic: data.title,
            startTime: startTime.toISOString(),
            duration: data.duration,
            timezone: data.timeZone || "UTC",
            joinUrl: chatUrl,
          },
        },
      };
    } catch (error) {
      console.error("Error creating Microsoft Teams meeting:", error);

      // Check if this is an insufficient permissions error
      const isInsufficientPermissions =
        error instanceof Error &&
        (error.message.includes("Insufficient Permission") ||
          error.message.includes("403") ||
          (error as any).code === 403);

      if (isInsufficientPermissions) {
        // Use standardized connection request for reconnection
        return createConnectionRequest({
          provider: "microsoft-teams",
          isReconnect: true,
          requiredScopes: this.config.scopes,
          customMessage:
            "You need additional permissions to create Teams chats. Please reconnect with the required scopes.",
        });
      }

      // Default error response
      return {
        success: false,
        status: "error",
        error:
          error instanceof Error
            ? error.message
            : "Failed to create Microsoft Teams chat",
        ui: {
          type: "error",
          message:
            "There was an error creating your Teams chat. Please try again later.",
        },
      };
    }
  }
}

// Register the tool with the registry
toolRegistry.register(new TeamsChatTool());
