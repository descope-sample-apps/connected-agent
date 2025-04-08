import { Tool, ToolConfig, ToolResponse, toolRegistry } from "./base";
import { getOAuthTokenWithScopeValidation } from "../oauth-utils";
import { getRequiredScopes } from "../openapi-utils";

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

export class DealsTool extends Tool<Deal | { id?: string }> {
  config: ToolConfig = {
    id: "crm-deals",
    name: "CRM Deals",
    description: "Create, fetch, and manage deals in your CRM system",
    scopes: [], // Will be populated dynamically
    requiredFields: [],
    optionalFields: [
      "id",
      "name",
      "amount",
      "stage",
      "probability",
      "closeDate",
      "accountId",
      "ownerId",
      "description",
      "notes",
    ],
    capabilities: [
      "Create and manage deals in CRM",
      "Track deal progress and stages",
      "Monitor deal values and probabilities",
      "Set and track close dates",
      "Associate deals with accounts and owners",
      "Add detailed descriptions and notes",
    ],
  };

  validate(data: Deal | { id?: string }): ToolResponse | null {
    // If we're fetching a deal (id is provided), no other validation needed
    if ("id" in data && data.id) {
      return null;
    }

    // For creation, validate required fields
    if (!("name" in data) || !data.name) {
      return {
        success: false,
        error: "Missing name",
        needsInput: {
          field: "name",
          message: "Please provide a deal name",
        },
      };
    }

    if (!("amount" in data) || !data.amount || data.amount <= 0) {
      return {
        success: false,
        error: "Invalid amount",
        needsInput: {
          field: "amount",
          message: "Please provide a valid deal amount",
        },
      };
    }

    if (!("stage" in data) || !data.stage) {
      return {
        success: false,
        error: "Missing stage",
        needsInput: {
          field: "stage",
          message: "Please provide a deal stage",
        },
      };
    }

    if (
      !("probability" in data) ||
      !data.probability ||
      data.probability < 0 ||
      data.probability > 100
    ) {
      return {
        success: false,
        error: "Invalid probability",
        needsInput: {
          field: "probability",
          message: "Please provide a valid probability (0-100)",
        },
      };
    }

    if (!("closeDate" in data) || !data.closeDate) {
      return {
        success: false,
        error: "Missing close date",
        needsInput: {
          field: "closeDate",
          message: "Please provide a close date",
        },
      };
    }

    if (!("accountId" in data) || !data.accountId) {
      return {
        success: false,
        error: "Missing account",
        needsInput: {
          field: "accountId",
          message: "Please provide an account ID",
        },
      };
    }

    if (!("ownerId" in data) || !data.ownerId) {
      return {
        success: false,
        error: "Missing owner",
        needsInput: {
          field: "ownerId",
          message: "Please provide an owner ID",
        },
      };
    }

    return null;
  }

  async execute(
    userId: string,
    data: Deal | { id?: string }
  ): Promise<ToolResponse> {
    try {
      console.log("[DealsTool] Starting execution with data:", {
        userId,
        data,
        isFetching: "id" in data && data.id !== undefined,
      });

      const validationError = this.validate(data);
      if (validationError) {
        console.log("[DealsTool] Validation failed:", validationError);
        return validationError;
      }

      // Get required scopes for CRM operations
      const crmScopes = await getRequiredScopes("crm", "deals.list");
      console.log("[DealsTool] Required CRM scopes:", crmScopes);

      // Get OAuth token for CRM
      console.log("[DealsTool] Requesting CRM token...");
      const crmTokenResponse = await getOAuthTokenWithScopeValidation(
        userId,
        "crm",
        {
          appId: "crm",
          userId,
          scopes: crmScopes,
          operation: "tool_calling",
        }
      );

      if ("error" in crmTokenResponse) {
        console.error("[DealsTool] CRM token error:", crmTokenResponse.error);
        return {
          success: false,
          error: crmTokenResponse.error,
          ui: {
            type: "connection_required",
            service: "custom-crm",
            message: "Please connect your CRM to access deals",
            connectButton: {
              text: "Connect CRM",
              action: "connection://custom-crm",
            },
          },
        };
      }

      // Determine if we're fetching or creating
      const isFetching = "id" in data && data.id !== undefined;
      const url = isFetching
        ? `${process.env.CRM_API_URL}/deals/${data.id}`
        : `${process.env.CRM_API_URL}/deals`;

      const response = await fetch(url, {
        method: isFetching ? "GET" : "POST",
        headers: {
          Authorization: `Bearer ${crmTokenResponse.token.accessToken}`,
          "Content-Type": "application/json",
        },
        ...(!isFetching && { body: JSON.stringify(data) }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Failed to ${isFetching ? "fetch" : "create"} deal: ${
            errorData.message || response.statusText
          }`
        );
      }

      const deal = await response.json();

      if (!isFetching && !deal?.id) {
        return {
          success: false,
          error: "Deal creation failed: No ID returned",
        };
      }

      return {
        success: true,
        data: deal,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to process deal",
      };
    }
  }
}

// Register the deals tool
toolRegistry.register(new DealsTool());
