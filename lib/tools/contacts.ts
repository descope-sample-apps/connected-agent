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
    requiredFields: ["name"],
    optionalFields: ["email", "phone", "company", "title", "notes"],
    capabilities: [
      "Create and manage contact profiles",
      "Store contact information and details",
      "Track contact company and role",
      "Add contact notes and history",
      "Manage contact relationships",
      "Update contact information",
      "Get contact details",
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

    // Only validate email if it's provided
    if (data.email) {
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
        "custom-crm",
        {
          appId: "custom-crm",
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
            service: "custom-crm",
            message: "Please connect your CRM to access contacts",
            connectButton: {
              text: "Connect CRM",
              action: "connection://custom-crm",
            },
          },
        };
      }

      // If no email is provided, first search for the contact by name in CRM
      if (!data.email) {
        console.log(
          "[ContactsTool] No email provided, searching for contact by name in CRM"
        );
        try {
          const searchResponse = await fetch(
            `${
              process.env.CRM_API_URL
            }/api/contacts/search?name=${encodeURIComponent(data.name)}`,
            {
              method: "GET",
              headers: {
                Authorization: `Bearer ${crmTokenResponse.token.accessToken}`,
                "Content-Type": "application/json",
              },
            }
          );

          if (searchResponse.ok) {
            const searchResults = await searchResponse.json();
            if (searchResults && searchResults.length > 0) {
              // Found a match, use the first result
              const existingContact = searchResults[0];
              console.log("[ContactsTool] Found existing contact:", {
                id: existingContact.id,
                name: existingContact.name,
                email: existingContact.email,
              });

              return {
                success: true,
                data: {
                  id: existingContact.id,
                  name: existingContact.name,
                  email: existingContact.email,
                  found: true,
                },
              };
            } else {
              console.log(
                "[ContactsTool] No contacts found with name:",
                data.name
              );
              return {
                success: true,
                data: {
                  notFound: true,
                  searchedName: data.name,
                  message: `No contact found in CRM with name "${data.name}".`,
                },
              };
            }
          } else if (searchResponse.status === 404) {
            // The search endpoint returned 404, likely meaning no contacts found
            console.log(
              "[ContactsTool] CRM search returned 404 for:",
              data.name
            );
            return {
              success: true,
              data: {
                notFound: true,
                searchedName: data.name,
                message: `I checked the CRM system, but no contact was found with the name "${data.name}".`,
              },
            };
          } else {
            console.error(
              "[ContactsTool] Error searching for contact:",
              searchResponse.statusText
            );
            return {
              success: false,
              error: `Error searching CRM: ${searchResponse.statusText}`,
              data: {
                searchError: true,
                message: `I encountered a problem searching for "${data.name}" in the CRM system.`,
              },
            };
          }
        } catch (searchError) {
          console.error(
            "[ContactsTool] Error searching for contact:",
            searchError
          );
          return {
            success: false,
            error: `CRM search error: ${
              searchError instanceof Error
                ? searchError.message
                : "Unknown error"
            }`,
            data: {
              searchError: true,
              message: `I encountered an error while trying to search for "${data.name}" in the CRM system.`,
            },
          };
        }

        // If we get here, we couldn't find the contact and need an email
        return {
          success: false,
          error: "Email required for new contact",
          needsInput: {
            field: "email",
            message: `I searched the CRM but couldn't find any contact named "${data.name}". Please provide an email address if you'd like to create this contact.`,
          },
        };
      }

      // If we have an email or found no matches, create a new contact
      console.log("[ContactsTool] Making API request to create contact");
      const response = await fetch(`${process.env.CRM_API_URL}/api/contacts`, {
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
