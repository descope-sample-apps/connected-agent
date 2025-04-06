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
  };

  validate(data: { id?: string }): ToolResponse | null {
    return null;
  }

  async execute(userId: string, data: { id?: string }): Promise<ToolResponse> {
    try {
      const token = await getOAuthTokenWithScopeValidation(userId, "crm", {
        appId: "crm",
        userId,
        scopes: [],
      });
      if (!token) {
        return {
          success: false,
          error: "Failed to get CRM access token",
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

class CRMDealsTool extends Tool<{ id?: string }> {
  config: ToolConfig = {
    id: "crm-deals",
    name: "CRM Deals",
    description: "Get all deals or a specific deal by ID",
    scopes: [],
    requiredFields: [],
    optionalFields: ["id"],
  };

  validate(data: { id?: string }): ToolResponse | null {
    return null;
  }

  async execute(userId: string, data: { id?: string }): Promise<ToolResponse> {
    try {
      const token = await getOAuthTokenWithScopeValidation(userId, "crm", {
        appId: "crm",
        userId,
        scopes: [],
      });
      if (!token) {
        return {
          success: false,
          error: "Failed to get CRM access token",
        };
      }

      const url = data.id
        ? `${process.env.CRM_API_URL}/deals/${data.id}`
        : `${process.env.CRM_API_URL}/deals`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Failed to fetch deals: ${errorData.message || response.statusText}`
        );
      }

      const deals = await response.json();
      return {
        success: true,
        data: deals,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch deals",
      };
    }
  }
}

// Register the CRM tools
toolRegistry.register(new CRMContactsTool());
toolRegistry.register(new CRMDealsTool());
