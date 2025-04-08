import { Tool, ToolConfig, ToolResponse, toolRegistry } from "./base";
import { getOAuthTokenWithScopeValidation } from "../oauth-utils";

export interface Contact {
  id?: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  title?: string;
  notes?: string;
}

export interface Deal {
  id?: string;
  name: string;
  amount: number;
  stage: string;
  probability: number;
  closeDate: string;
  accountId: string;
  ownerId: string;
  description?: string;
  notes?: string;
}

class CRMContactsTool extends Tool<{ id?: string }> {
  config: ToolConfig = {
    id: "crm-contacts",
    name: "CRM Contacts",
    description: "Get all contacts or a specific contact by ID",
    scopes: [],
    requiredFields: [],
    optionalFields: ["id"],
    capabilities: [
      "Search and retrieve contact information",
      "View contact details including name, email, and company",
      "Access contact history and interactions",
      "Manage contact relationships and associations",
    ],
  };

  validate(data: { id?: string }): ToolResponse | null {
    return null;
  }

  async execute(userId: string, data: { id?: string }): Promise<ToolResponse> {
    try {
      const token = await getOAuthTokenWithScopeValidation(userId, "crm", {
        appId: "custom-crm",
        userId,
        scopes: [],
        operation: "tool_calling",
      });
      if (!token) {
        return {
          success: false,
          error: "Failed to get CRM access token",
          ui: {
            type: "connection_required",
            service: "custom-crm",
            message: "CRM access is required to view contacts.",
            connectButton: {
              text: "Connect CRM",
              action: "connection://custom-crm",
            },
          },
        };
      }

      const url = data.id
        ? `${process.env.CRM_API_URL}/contacts/${data.id}`
        : `${process.env.CRM_API_URL}/contacts`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Failed to fetch contacts: ${
            errorData.message || response.statusText
          }`
        );
      }

      const contacts = await response.json();
      return {
        success: true,
        data: contacts,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch contacts",
      };
    }
  }
}

interface CRMDealsArgs {
  id?: string;
}

interface ToolCallOptions {
  userId: string;
}

export class CRMDealsTool extends Tool<CRMDealsArgs> {
  config: ToolConfig = {
    id: "crm-deals",
    name: "CRM Deals",
    description: "Get all deals or a specific deal by ID",
    scopes: [],
    requiredFields: [],
    optionalFields: ["id"],
    capabilities: [
      "View and track deal progress",
      "Access deal details including amount and stage",
      "Monitor deal probability and close dates",
      "Track deal history and updates",
    ],
  };

  validate(data: CRMDealsArgs): ToolResponse | null {
    return null;
  }

  async execute(userId: string, data: CRMDealsArgs): Promise<ToolResponse> {
    const apiUrl = process.env.CRM_API_URL;

    // Check if CRM API URL is configured
    if (!apiUrl) {
      return {
        success: false,
        error: "CRM API is not properly configured",
        ui: {
          type: "connection_required",
          service: "custom-crm",
          message:
            "CRM API is not properly configured. Please contact support.",
          connectButton: {
            text: "Contact Support",
            action: "connection://support",
          },
        },
      };
    }

    try {
      // Get OAuth token
      const tokenResponse = await getOAuthTokenWithScopeValidation(
        userId,
        "crm",
        {
          appId: "custom-crm",
          userId,
          scopes: [],
          operation: "tool_calling",
        }
      );

      if (!tokenResponse || "error" in tokenResponse) {
        return {
          success: false,
          error: "CRM access required",
          ui: {
            type: "connection_required",
            service: "custom-crm",
            message: "CRM access is required to view deals data",
            connectButton: {
              text: "Connect CRM",
              action: "connection://custom-crm",
            },
          },
        };
      }

      const accessToken = tokenResponse.token.accessToken;

      // Attempt to fetch deals data
      try {
        const requestUrl = data.id
          ? `${apiUrl}/deals/${data.id}`
          : `${apiUrl}/deals`;

        const response = await fetch(requestUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        });

        // Handle auth errors
        if (response.status === 401 || response.status === 403) {
          return {
            success: false,
            error: "Authentication failed",
            ui: {
              type: "connection_required",
              service: "custom-crm",
              message:
                "Your CRM connection has expired or needs to be reauthorized",
              connectButton: {
                text: "Reconnect CRM",
                action: "connection://custom-crm",
              },
            },
          };
        }

        if (!response.ok) {
          throw new Error(`CRM API error: ${response.status}`);
        }

        const responseData = await response.json();
        return {
          success: true,
          data: responseData,
        };
      } catch (error) {
        return {
          success: false,
          error: `Error fetching CRM data: ${error}`,
          ui: {
            type: "connection_required",
            service: "custom-crm",
            message:
              "There was an error connecting to your CRM. Please try reconnecting.",
            connectButton: {
              text: "Reconnect CRM",
              action: "connection://custom-crm",
            },
          },
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Error accessing CRM: ${error}`,
        ui: {
          type: "connection_required",
          service: "custom-crm",
          message: "We encountered an error with your CRM connection",
          connectButton: {
            text: "Reconnect CRM",
            action: "connection://custom-crm",
          },
        },
      };
    }
  }

  // Implementation for the call method required by newer API
  async call(arg: string, options: ToolCallOptions): Promise<string> {
    const args = arg ? (JSON.parse(arg) as CRMDealsArgs) : {};
    const response = await this.execute(options.userId, args);
    return JSON.stringify(response);
  }
}

// Register the CRM tools
toolRegistry.register(new CRMContactsTool());
toolRegistry.register(new CRMDealsTool());
