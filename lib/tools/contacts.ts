import { Tool, ToolConfig, ToolResponse, toolRegistry } from "./base";
import { getOAuthTokenWithScopeValidation } from "../oauth-utils";
import { getRequiredScopes } from "../openapi-utils";

export interface Contact {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  title?: string;
  notes?: string;
}

export class ContactsTool extends Tool<Contact> {
  config: ToolConfig = {
    id: "crm-contacts",
    name: "CRM Contacts",
    description: "Create and manage contacts in your CRM system",
    scopes: [], // Will be populated dynamically
    requiredFields: ["name", "email"],
    optionalFields: ["phone", "company", "title", "notes"],
    capabilities: [
      "Create and manage contact profiles",
      "Store contact information and details",
      "Track contact company and role",
      "Add contact notes and history",
      "Manage contact relationships",
      "Update contact information",
    ],
  };

  validate(data: Contact): ToolResponse | null {
    if (!data.name) {
      return {
        success: false,
        error: "Missing name",
        needsInput: {
          field: "name",
          message: "Please provide a contact name",
        },
      };
    }

    if (!data.email) {
      return {
        success: false,
        error: "Missing email",
        needsInput: {
          field: "email",
          message: "Please provide a contact email",
        },
      };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      return {
        success: false,
        error: "Invalid email",
        needsInput: {
          field: "email",
          message: "Please provide a valid email address",
          currentValue: data.email,
        },
      };
    }

    return null;
  }

  async execute(userId: string, data: Contact): Promise<ToolResponse> {
    try {
      console.log("[ContactsTool] Starting execution with data:", {
        userId,
        name: data.name,
        email: data.email,
      });

      const validationError = this.validate(data);
      if (validationError) {
        console.log("[ContactsTool] Validation failed:", validationError);
        return validationError;
      }

      // Get required scopes for CRM operations
      const crmScopes = await getRequiredScopes("crm", "contacts.create");
      console.log("[ContactsTool] Required CRM scopes:", crmScopes);

      // Get OAuth token for CRM
      console.log("[ContactsTool] Requesting CRM token...");
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
        console.error(
          "[ContactsTool] CRM token error:",
          crmTokenResponse.error
        );
        return {
          success: false,
          error: crmTokenResponse.error,
          ui: {
            type: "connection_required",
            service: "crm",
            message:
              "Your CRM connection needs to be refreshed to manage contacts.",
            connectButton: {
              text: "Connect CRM",
              action: "connection://crm",
            },
          },
        };
      }

      console.log("[ContactsTool] Making API request");
      const response = await fetch(`${process.env.CRM_API_URL}/contacts`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${crmTokenResponse.token.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      console.log("[ContactsTool] API response status:", response.status);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("[ContactsTool] API error:", errorData);
        throw new Error(
          `Failed to create contact: ${
            errorData.message || response.statusText
          }`
        );
      }

      const contact = await response.json();
      console.log("[ContactsTool] Contact created:", {
        id: contact.id,
        name: contact.name,
      });

      if (!contact?.id) {
        console.error("[ContactsTool] Contact creation failed: No ID returned");
        return {
          success: false,
          error: "Contact creation failed: No ID returned",
        };
      }

      return {
        success: true,
        data: {
          id: contact.id,
          name: contact.name,
          email: contact.email,
        },
      };
    } catch (error) {
      console.error("[ContactsTool] Error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create contact",
      };
    }
  }
}

// Register the contacts tool
toolRegistry.register(new ContactsTool());
