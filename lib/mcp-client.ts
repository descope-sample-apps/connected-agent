import { EventSourcePolyfill } from "event-source-polyfill";

export interface MCPTool {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
}

export interface MCPConnection {
  serverUrl: string;
  tools: MCPTool[];
  accessToken: string;
  eventSource: EventSourcePolyfill | null;
}

export class MCPClient {
  private connections: Map<string, MCPConnection> = new Map();

  async connectToServer(
    serverUrl: string,
    userId: string
  ): Promise<MCPConnection> {
    try {
      // First, get OAuth token for the MCP server
      const tokenResponse = await fetch("/api/oauth/mcp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          serverUrl,
          userId,
        }),
      });

      if (!tokenResponse.ok) {
        throw new Error("Failed to get OAuth token for MCP server");
      }

      const { accessToken } = await tokenResponse.json();

      // Get available tools from the MCP server
      const toolsResponse = await fetch(`${serverUrl}/tools`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!toolsResponse.ok) {
        throw new Error("Failed to get tools from MCP server");
      }

      const tools = await toolsResponse.json();

      // Create SSE connection
      const eventSource = new EventSourcePolyfill(`${serverUrl}/events`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const connection: MCPConnection = {
        serverUrl,
        tools,
        accessToken,
        eventSource,
      };

      this.connections.set(userId, connection);

      // Set up event listeners
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log("MCP Server Event:", data);
        // Handle different event types here
      };

      eventSource.onerror = (error) => {
        console.error("MCP Server SSE Error:", error);
        // Handle connection errors
      };

      return connection;
    } catch (error) {
      console.error("Failed to connect to MCP server:", error);
      throw error;
    }
  }

  async executeTool(
    userId: string,
    toolName: string,
    parameters: any
  ): Promise<any> {
    const connection = this.connections.get(userId);
    if (!connection) {
      throw new Error("Not connected to MCP server");
    }

    const tool = connection.tools.find((t) => t.name === toolName);
    if (!tool) {
      throw new Error(`Tool ${toolName} not found`);
    }

    const response = await fetch(`${connection.serverUrl}/tools/${toolName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${connection.accessToken}`,
      },
      body: JSON.stringify(parameters),
    });

    if (!response.ok) {
      throw new Error(`Failed to execute tool ${toolName}`);
    }

    return response.json();
  }

  disconnect(userId: string) {
    const connection = this.connections.get(userId);
    if (connection) {
      connection.eventSource?.close();
      this.connections.delete(userId);
    }
  }
}

// Create a singleton instance
export const mcpClient = new MCPClient();
