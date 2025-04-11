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

class CRMContactsTool extends Tool<{
  id?: string;
  name?: string;
  email?: string;
}> {
  config: ToolConfig = {
    id: "crm-contacts",
    name: "CRM Contacts",
    description:
      "Get all contacts or search for contacts by name, email, or ID",
    scopes: [],
    requiredFields: [],
    optionalFields: ["id", "name", "email"],
    capabilities: [
      "Search and retrieve contact information",
      "View contact details including name, email, and company",
      "Access contact history and interactions",
      "Manage contact relationships and associations",
    ],
  };

  validate(data: {
    id?: string;
    name?: string;
    email?: string;
  }): ToolResponse | null {
    return null;
  }

  async execute(
    userId: string,
    data: { id?: string; name?: string; email?: string }
  ): Promise<ToolResponse> {
    try {
      const token = await getOAuthTokenWithScopeValidation(userId, "crm", {
        appId: "custom-crm",
        userId,
        scopes: ["openid", "contacts:read", "deals:read"],
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

      // If we have an ID, fetch the specific contact
      if (data.id) {
        const response = await fetch(
          `${process.env.CRM_API_URL}/contacts/${data.id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            `Failed to fetch contact: ${
              errorData.message || response.statusText
            }`
          );
        }

        const contact = await response.json();
        return {
          success: true,
          data: contact,
        };
      }

      // If we have an email, fetch the specific contact
      if (data.email) {
        const response = await fetch(
          `${process.env.CRM_API_URL}/contacts/${encodeURIComponent(
            data.email
          )}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            `Failed to fetch contact: ${
              errorData.message || response.statusText
            }`
          );
        }

        const contact = await response.json();
        return {
          success: true,
          data: contact,
        };
      }

      // If we have a name, first fetch all contacts and filter
      if (data.name) {
        // First, get all contacts
        const response = await fetch(`${process.env.CRM_API_URL}/contacts`, {
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

        const allContacts = await response.json();

        // Filter contacts by name (case-insensitive partial match)
        const matchingContacts = allContacts.filter((contact: Contact) =>
          contact.name.toLowerCase().includes(data.name!.toLowerCase())
        );

        return {
          success: true,
          data: matchingContacts,
        };
      }

      // If no search parameters, return all contacts
      const response = await fetch(`${process.env.CRM_API_URL}/contacts`, {
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
        "custom-crm",
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
