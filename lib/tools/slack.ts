import { z } from "zod";
import { getSlackToken } from "@/lib/descope";
import { Tool, ToolResponse, ToolConfig } from "./base";

/**
 * SlackTool provides functionality to interact with Slack
 * - Send messages to channels
 * - Create new channels
 * - Invite users to channels
 * - Get messages from channels
 * - Search messages in Slack
 */
export class SlackTool extends Tool<any> {
  config: ToolConfig = {
    id: "slack",
    name: "Slack",
    description:
      "Send messages, get messages, search messages, and manage channels in Slack",
    scopes: ["chat:write", "channels:manage", "users:read"],
    requiredFields: ["action"],
    optionalFields: [
      "channelName",
      "channelId",
      "message",
      "users",
      "topic",
      "query",
      "limit",
      "oldest",
      "latest",
    ],
    capabilities: [
      "send_slack_message",
      "create_slack_channel",
      "invite_slack_users",
      "get_slack_messages",
      "search_slack",
    ],
    parameters: {},
  };

  validate(data: any): ToolResponse | null {
    // First validate action is set
    if (!data.action) {
      return {
        success: false,
        error: "Action is required",
      };
    }

    // Validate required fields based on action
    switch (data.action) {
      case "send_message":
        if (!data.channelId && !data.channelName) {
          return {
            success: false,
            error: "Either channelId or channelName is required",
          };
        }
        if (!data.message) {
          return {
            success: false,
            error: "Message is required",
          };
        }
        break;

      case "create_channel":
        if (!data.channelName) {
          return {
            success: false,
            error: "Channel name is required",
          };
        }
        break;

      case "invite_user":
        if (!data.channelId && !data.channelName) {
          return {
            success: false,
            error: "Either channelId or channelName is required",
          };
        }
        if (
          !data.users ||
          !Array.isArray(data.users) ||
          data.users.length === 0
        ) {
          return {
            success: false,
            error: "Users list is required",
          };
        }
        break;

      case "get_messages":
        if (!data.channelId && !data.channelName) {
          return {
            success: false,
            error: "Either channelId or channelName is required",
          };
        }
        break;

      case "search":
        if (!data.query) {
          return {
            success: false,
            error: "Search query is required",
          };
        }
        break;

      default:
        return {
          success: false,
          error: `Unsupported action: ${data.action}`,
        };
    }

    // If all validations pass
    return null;
  }

  async execute(userId: string, params: any): Promise<ToolResponse> {
    try {
      // Get Slack access token
      const tokenResponse = await getSlackToken(userId, "tool_calling");

      if (!tokenResponse) {
        return {
          success: false,
          error: "Slack connection is required",
          ui: {
            type: "connection_required",
            service: "slack",
            message:
              "Please connect your Slack to access messages and channels",
            connectButton: {
              text: "Connect Slack",
              action: "connection://slack",
            },
          },
        };
      }

      // Check if token response indicates an error
      if ("error" in tokenResponse) {
        return {
          success: false,
          error: "Slack connection is required",
          ui: {
            type: "connection_required",
            service: "slack",
            message:
              "Please connect your Slack to access messages and channels",
            connectButton: {
              text: "Connect Slack",
              action: "connection://slack",
            },
          },
        };
      }

      const accessToken = tokenResponse.token.accessToken;

      // Determine which action to perform
      switch (params.action) {
        case "send_message":
          return await this.sendMessage(accessToken, params);
        case "create_channel":
          return await this.createChannel(accessToken, params);
        case "invite_user":
          return await this.inviteUser(accessToken, params);
        case "get_messages":
          return await this.getMessages(accessToken, params);
        case "search":
          return await this.searchSlack(accessToken, params);
        default:
          return {
            success: false,
            error: `Unsupported action: ${params.action}`,
          };
      }
    } catch (error) {
      console.error("Error executing Slack tool:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async sendMessage(
    accessToken: string,
    params: any
  ): Promise<ToolResponse> {
    try {
      // If channelName is provided but not channelId, we need to find the channel
      let channelId = params.channelId;
      if (!channelId && params.channelName) {
        // Get channel ID by name
        const response = await fetch(
          "https://slack.com/api/conversations.list",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
          }
        );

        const data = await response.json();

        if (!data.ok) {
          return {
            success: false,
            error: data.error || "Failed to fetch channels",
          };
        }

        const channel = data.channels.find(
          (ch: any) => ch.name === params.channelName.replace("#", "")
        );

        if (!channel) {
          return {
            success: false,
            error: "Channel not found",
          };
        }

        channelId = channel.id;
      }

      // Send the message to the channel
      const response = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          channel: channelId,
          text: params.message,
        }),
      });

      const data = await response.json();

      if (!data.ok) {
        return {
          success: false,
          error: data.error || "Failed to send message",
        };
      }

      return {
        success: true,
        data: {
          messageId: data.ts,
          channelId: data.channel,
          formattedMessage: `✅ Message sent successfully to ${
            params.channelName || `the channel`
          } on Slack.`,
        },
      };
    } catch (error) {
      console.error("Error sending Slack message:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async createChannel(
    accessToken: string,
    params: any
  ): Promise<ToolResponse> {
    try {
      // Create a new channel
      const response = await fetch(
        "https://slack.com/api/conversations.create",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: params.channelName
              .replace("#", "")
              .replace(/\s+/g, "-")
              .toLowerCase(),
            is_private: false,
          }),
        }
      );

      const data = await response.json();

      if (!data.ok) {
        // If channel already exists, provide a helpful message
        if (data.error === "name_taken") {
          return {
            success: false,
            error: "Channel already exists",
          };
        }

        return {
          success: false,
          error: data.error || "Failed to create channel",
        };
      }

      // Set channel topic if provided
      if (params.topic) {
        await fetch("https://slack.com/api/conversations.setTopic", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            channel: data.channel.id,
            topic: params.topic,
          }),
        });
      }

      return {
        success: true,
        data: {
          channelId: data.channel.id,
          channelName: data.channel.name,
          formattedMessage: `✅ Created new Slack channel #${data.channel.name}`,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async inviteUser(
    accessToken: string,
    params: any
  ): Promise<ToolResponse> {
    try {
      // If channelName is provided but not channelId, find the channel
      let channelId = params.channelId;
      if (!channelId && params.channelName) {
        // Get channel ID by name (same as in sendMessage)
        const response = await fetch(
          "https://slack.com/api/conversations.list",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
          }
        );

        const data = await response.json();

        if (!data.ok) {
          return {
            success: false,
            error: data.error || "Failed to fetch channels",
          };
        }

        const channel = data.channels.find(
          (ch: any) => ch.name === params.channelName.replace("#", "")
        );

        if (!channel) {
          return {
            success: false,
            error: "Channel not found",
          };
        }

        channelId = channel.id;
      }

      // Get user IDs for the emails
      const userIds = [];
      for (const email of params.users) {
        // Look up user by email
        const userResponse = await fetch(
          "https://slack.com/api/users.lookupByEmail",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email: email,
            }),
          }
        );

        const userData = await userResponse.json();

        if (userData.ok) {
          userIds.push(userData.user.id);
        }
      }

      if (userIds.length === 0) {
        return {
          success: false,
          error: "No valid users found",
        };
      }

      // Invite users to the channel
      const response = await fetch(
        "https://slack.com/api/conversations.invite",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            channel: channelId,
            users: userIds.join(","),
          }),
        }
      );

      const data = await response.json();

      if (!data.ok) {
        // If users are already in the channel
        if (data.error === "already_in_channel") {
          return {
            success: true,
            data: {
              channelId: channelId,
              usersInvited: userIds.length,
              formattedMessage: `✅ The users are already members of ${
                params.channelName || "the channel"
              }.`,
            },
          };
        }

        return {
          success: false,
          error: data.error || "Failed to invite users",
        };
      }

      return {
        success: true,
        data: {
          channelId: data.channel.id,
          usersInvited: userIds.length,
          formattedMessage: `✅ Invited ${userIds.length} user(s) to ${
            params.channelName || "the channel"
          } on Slack.`,
        },
      };
    } catch (error) {
      console.error("Error inviting users to Slack channel:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async getMessages(
    accessToken: string,
    params: any
  ): Promise<ToolResponse> {
    try {
      // If channelName is provided but not channelId, we need to find the channel
      let channelId = params.channelId;
      if (!channelId && params.channelName) {
        // Get channel ID by name
        const response = await fetch(
          "https://slack.com/api/conversations.list",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
          }
        );

        const data = await response.json();

        if (!data.ok) {
          return {
            success: false,
            error: data.error || "Failed to fetch channels",
          };
        }

        const channel = data.channels.find(
          (ch: any) => ch.name === params.channelName.replace("#", "")
        );

        if (!channel) {
          return {
            success: false,
            error: "Channel not found",
          };
        }

        channelId = channel.id;
      }

      // Prepare parameters for the history API
      const historyParams: Record<string, any> = {
        channel: channelId,
        limit: params.limit || 10,
      };

      if (params.oldest) {
        historyParams.oldest = params.oldest;
      }

      if (params.latest) {
        historyParams.latest = params.latest;
      }

      // Get messages from the channel
      const response = await fetch(
        "https://slack.com/api/conversations.history",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(historyParams),
        }
      );

      const data = await response.json();

      if (!data.ok) {
        return {
          success: false,
          error: data.error || "Failed to get messages",
        };
      }

      // Get user info for each message
      const userCache: Record<string, any> = {};
      const messages = await Promise.all(
        data.messages.map(async (message: any) => {
          let userName = "Unknown User";

          if (message.user && !userCache[message.user]) {
            try {
              const userResponse = await fetch(
                "https://slack.com/api/users.info",
                {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({ user: message.user }),
                }
              );

              const userData = await userResponse.json();
              if (userData.ok) {
                userCache[message.user] = {
                  name: userData.user.real_name || userData.user.name,
                  username: userData.user.name,
                };
              }
            } catch (e) {
              console.error("Error fetching user info:", e);
            }
          }

          if (message.user && userCache[message.user]) {
            userName = userCache[message.user].name;
          }

          return {
            ts: message.ts,
            text: message.text,
            user: userName,
            timestamp: new Date(
              parseInt(message.ts.split(".")[0]) * 1000
            ).toISOString(),
          };
        })
      );

      return {
        success: true,
        data: {
          channelId,
          channelName: params.channelName,
          messages,
          hasMore: data.has_more,
          messageCount: messages.length,
          formattedMessage: `Retrieved ${messages.length} messages from ${
            params.channelName || `the channel`
          }.`,
        },
      };
    } catch (error) {
      console.error("Error getting Slack messages:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async searchSlack(
    accessToken: string,
    params: any
  ): Promise<ToolResponse> {
    try {
      // Prepare search parameters
      const searchParams = new URLSearchParams();
      searchParams.append("query", params.query);

      if (params.limit) {
        searchParams.append("count", params.limit.toString());
      }

      if (params.sort) {
        searchParams.append("sort", params.sort);
      }

      if (params.sort_dir) {
        searchParams.append("sort_dir", params.sort_dir);
      }

      // Search Slack
      const response = await fetch(
        `https://slack.com/api/search.messages?${searchParams.toString()}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();

      if (!data.ok) {
        return {
          success: false,
          error: data.error || "Failed to search Slack",
        };
      }

      // Format search results
      const messages = data.messages.matches.map((match: any) => {
        return {
          text: match.text,
          permalink: match.permalink,
          username: match.username,
          channelName: match.channel.name,
          timestamp: new Date(
            parseInt(match.ts.split(".")[0]) * 1000
          ).toISOString(),
        };
      });

      return {
        success: true,
        data: {
          query: params.query,
          resultCount: data.messages.total,
          results: messages,
          formattedMessage: `Found ${data.messages.total} messages matching "${params.query}".`,
        },
      };
    } catch (error) {
      console.error("Error searching Slack:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

// Register the Slack tool with the tool registry
import { toolRegistry } from "./base";
toolRegistry.register(new SlackTool());
