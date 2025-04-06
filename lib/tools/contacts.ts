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
      const validationError = this.validate(data);
      if (validationError) {
        return validationError;
      }

      // Get required scopes for CRM operations
      const crmScopes = await getRequiredScopes("crm", "contacts.create");

      // Get OAuth token for CRM
      const crmTokenResponse = await getOAuthTokenWithScopeValidation(
        userId,
        "crm",
        {
          appId: "crm",
          userId,
          scopes: crmScopes,
        }
      );

      if ("error" in crmTokenResponse) {
        return {
          success: false,
          error: crmTokenResponse.error,
        };
      }

      const response = await fetch(`${process.env.CRM_API_URL}/contacts`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${crmTokenResponse.token.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Failed to create contact: ${
            errorData.message || response.statusText
          }`
        );
      }

      const contact = await response.json();

      if (!contact?.id) {
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
