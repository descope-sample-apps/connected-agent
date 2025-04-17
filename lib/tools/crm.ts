import {
  Tool,
  ToolConfig,
  ToolResponse,
  toolRegistry,
  createConnectionRequest,
} from "./base";
import { getOAuthTokenWithScopeValidation } from "../oauth-utils";
import { z } from "zod";

export interface Contact {
  id: string;
  name: string;
  email: string;
  role?: string;
  company?: string;
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

// Define types for CRM data
export interface CRMContact {
  id: string;
  name: string;
  email: string;
  company: string;
  status: string;
  lastContact: string;
  phone: string;
  address: string;
  notes: string;
  created_at: string;
  deals?: CRMDealDetails[];
}

export interface CRMActivity {
  id: string;
  type: string;
  customer: string;
  dealId: string;
  date: string;
  notes: string;
  completed: boolean;
}

export interface CRMDealDetails {
  id: string;
  name: string;
  value: number;
  stage: string;
  customerId: string;
  ownerId: string;
  expectedCloseDate: string;
  probability: number;
  created_at: string;
  notes: string;
  customer?: {
    id: string;
    name: string;
    email: string;
    company: string;
  };
  owner?: {
    id: string;
    name: string;
    email: string;
    position: string;
  };
  activities?: CRMActivity[];
}

export interface Stakeholder {
  type: "customer" | "internal";
  id: string;
  name: string;
  email: string;
  company?: string;
  position?: string;
  role: string;
}

// CRM Contacts Tool
export class CRMContactsTool extends Tool<{
  query?: string;
}> {
  config: ToolConfig = {
    id: "crm-contacts",
    name: "CRM Contacts",
    description: "Get customer contacts from the CRM system",
    scopes: ["contacts:read"],
    requiredFields: [],
    optionalFields: ["query"],
    capabilities: [
      "Search for contacts by name, email, or company",
      "Retrieve contact details including role and notes",
      "Find customer information for scheduling meetings",
    ],
    oauthConfig: {
      provider: "custom-crm",
      defaultScopes: ["contacts:read"],
      requiredScopes: ["openid"],
      scopeMapping: {
        "contacts.list": ["contacts:read"],
        "contacts.search": ["contacts:read"],
        "contacts.create": ["contacts:write"],
        "contacts.update": ["contacts:write"],
      },
    },
  };

  validate(data: { query?: string }): ToolResponse | null {
    return null;
  }

  async execute(
    userId: string,
    data: { query?: string }
  ): Promise<ToolResponse> {
    try {
      console.log("[CRMContactsTool] Executing with query:", data.query);

      // Get token without specifying scopes to let Descope handle defaults
      console.log("[CRMContactsTool] Getting token without hardcoded scopes");
      const tokenResponse = await getOAuthTokenWithScopeValidation(
        userId,
        "custom-crm",
        {
          appId: "custom-crm",
          userId,
          operation: "contacts.list",
          toolId: this.config.id,
        }
      );

      console.log("[CRMContactsTool] Token response:", {
        hasError: !tokenResponse || "error" in tokenResponse,
        error: "error" in tokenResponse ? tokenResponse.error : null,
        hasToken: tokenResponse && "token" in tokenResponse,
      });

      if (!tokenResponse || "error" in tokenResponse) {
        // Only extract scope information if available in the token response
        const requiredScopes =
          "requiredScopes" in tokenResponse && tokenResponse.requiredScopes
            ? tokenResponse.requiredScopes
            : undefined;
        const currentScopes =
          "currentScopes" in tokenResponse && tokenResponse.currentScopes
            ? tokenResponse.currentScopes
            : undefined;

        console.log("[CRMContactsTool] Creating connection request:", {
          provider: "custom-crm",
          isReconnect: currentScopes && currentScopes.length > 0,
          hasRequiredScopes: !!requiredScopes,
          requiredScopesCount: requiredScopes?.length || 0,
        });

        // Use standardized connection request
        return createConnectionRequest({
          provider: "custom-crm",
          isReconnect: currentScopes && currentScopes.length > 0,
          requiredScopes,
          currentScopes,
          customMessage: "CRM access is required to view contacts.",
          toolId: this.config.id,
          operation: "contacts.list",
        });
      }

      // Extract the actual token from the response
      const accessToken = tokenResponse.token!.accessToken;
      console.log(
        "[CRMContactsTool] Successfully got access token, fetching contacts"
      );

      // Use our enhanced contact fetching function
      const responseData = await fetchCRMContacts(accessToken, data.query);

      return {
        success: true,
        data: responseData.data,
      };
    } catch (error) {
      console.error("[CRMContactsTool] Error:", error);

      // Check if this is an authentication error
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      const isAuthError =
        errorMsg.includes("auth") ||
        errorMsg.includes("permission") ||
        errorMsg.includes("token") ||
        errorMsg.includes("401") ||
        errorMsg.includes("403");

      if (isAuthError) {
        console.log(
          "[CRMContactsTool] Auth error detected, creating connection request"
        );
        return createConnectionRequest({
          provider: "custom-crm",
          customMessage:
            "There was an error connecting to your CRM. Please reconnect.",
          toolId: this.config.id,
        });
      }

      return {
        success: false,
        error: errorMsg,
        ui: {
          type: "error",
          message: "Failed to fetch contacts from your CRM. Please try again.",
        },
      };
    }
  }
}

// CRM Deals Tool
export class CRMDealsTool extends Tool<{
  dealId?: string;
  contactId?: string;
  stage?: string;
  companyName?: string;
}> {
  config: ToolConfig = {
    id: "crm-deals",
    name: "CRM Deals",
    description: "Get deals from the CRM system",
    scopes: ["deals:read"],
    requiredFields: [],
    optionalFields: ["dealId", "contactId", "stage", "companyName"],
    capabilities: [
      "Retrieve deal information by ID",
      "Filter deals by customer or stage",
      "Search deals by company name",
      "Get deal details including value and probability",
    ],
    oauthConfig: {
      provider: "custom-crm",
      defaultScopes: ["deals:read"],
      requiredScopes: ["openid"],
      scopeMapping: {
        "deals.list": ["deals:read"],
        "deals.search": ["deals:read"],
        "deals.create": ["deals:write"],
        "deals.update": ["deals:write"],
      },
    },
  };

  validate(data: {
    dealId?: string;
    contactId?: string;
    stage?: string;
    companyName?: string;
  }): ToolResponse | null {
    return null;
  }

  async execute(
    userId: string,
    data: {
      dealId?: string;
      contactId?: string;
      stage?: string;
      companyName?: string;
    }
  ): Promise<ToolResponse> {
    try {
      // Get token without specifying scopes to let Descope handle defaults
      console.log("[CRMDealsTool] Getting token without hardcoded scopes");
      const tokenResponse = await getOAuthTokenWithScopeValidation(
        userId,
        "custom-crm",
        {
          appId: "custom-crm",
          userId,
          operation: "deals.list",
          toolId: this.config.id,
        }
      );

      if (!tokenResponse || "error" in tokenResponse) {
        // Only extract scope information if available in the token response
        const requiredScopes =
          "requiredScopes" in tokenResponse && tokenResponse.requiredScopes
            ? tokenResponse.requiredScopes
            : undefined;
        const currentScopes =
          "currentScopes" in tokenResponse && tokenResponse.currentScopes
            ? tokenResponse.currentScopes
            : undefined;

        // Use standardized connection request
        return createConnectionRequest({
          provider: "custom-crm",
          isReconnect: currentScopes && currentScopes.length > 0,
          requiredScopes,
          currentScopes,
          customMessage: "CRM access is required to view deals.",
          toolId: this.config.id,
          operation: "deals.list",
        });
      }

      // Extract the actual token from the response
      const accessToken = tokenResponse.token!.accessToken;

      // Use our enhanced deals fetching function
      const responseData = await fetchCRMDeals(
        accessToken,
        data.dealId,
        data.contactId,
        data.stage,
        data.companyName
      );

      return {
        success: true,
        data: responseData.data,
      };
    } catch (error) {
      console.error("CRM Deals Tool Error:", error);

      // Check if this is an authentication error
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      const isAuthError =
        errorMsg.includes("auth") ||
        errorMsg.includes("permission") ||
        errorMsg.includes("token") ||
        errorMsg.includes("401") ||
        errorMsg.includes("403");

      if (isAuthError) {
        return createConnectionRequest({
          provider: "custom-crm",
          customMessage:
            "There was an error connecting to your CRM. Please reconnect.",
          toolId: this.config.id,
        });
      }

      return {
        success: false,
        error: errorMsg,
        ui: {
          type: "error",
          message: "Failed to fetch deals from your CRM. Please try again.",
        },
      };
    }
  }
}

// Deal Stakeholders Tool
export class DealStakeholdersTool extends Tool<{
  dealId: string;
}> {
  config: ToolConfig = {
    id: "crm-deal-stakeholders",
    name: "Deal Stakeholders",
    description: "Get stakeholders for a specific deal from the CRM system",
    scopes: ["deals:read", "contacts:read"],
    requiredFields: ["dealId"],
    capabilities: [
      "Retrieve stakeholders for a deal, including customers and internal team members",
      "Get contact information for everyone involved in a deal",
    ],
    oauthConfig: {
      provider: "custom-crm",
      defaultScopes: ["deals:read", "contacts:read"],
      requiredScopes: ["openid"],
      scopeMapping: {
        "stakeholders.list": ["deals:read", "contacts:read"],
      },
    },
  };

  validate(data: { dealId: string }): ToolResponse | null {
    if (!data.dealId) {
      return {
        success: false,
        error: "dealId is required",
      };
    }
    return null;
  }

  async execute(
    userId: string,
    data: { dealId: string }
  ): Promise<ToolResponse> {
    try {
      // Get token with necessary scopes
      const tokenResponse = await getOAuthTokenWithScopeValidation(
        userId,
        "custom-crm",
        {
          appId: "custom-crm",
          userId,
          operation: "stakeholders.list",
          toolId: this.config.id,
        }
      );

      if (!tokenResponse || "error" in tokenResponse) {
        const errorMsg =
          tokenResponse && "error" in tokenResponse
            ? tokenResponse.error
            : "Failed to get CRM access token";

        // Get currentScopes if available in the error response
        const currentScopes =
          tokenResponse &&
          "error" in tokenResponse &&
          "currentScopes" in tokenResponse
            ? tokenResponse.currentScopes
            : undefined;

        return createConnectionRequest({
          provider: "custom-crm",
          customMessage: "CRM access is required to view deal stakeholders.",
          toolId: this.config.id,
          operation: "stakeholders.list",
          currentScopes,
        });
      }

      // Extract the actual token from the response
      const accessToken = tokenResponse.token?.accessToken;

      // Use our enhanced deal stakeholders function
      const stakeholdersData = await fetchDealStakeholders(
        accessToken!,
        data.dealId
      );

      return {
        success: true,
        data: stakeholdersData,
      };
    } catch (error) {
      console.error("Deal Stakeholders Tool Error:", error);
      return createConnectionRequest({
        provider: "custom-crm",
        customMessage: "There was an error connecting to your CRM",
        toolId: this.config.id,
        isReconnect: true,
      });
    }
  }
}

// Register CRM tools
toolRegistry.register(new CRMContactsTool());
toolRegistry.register(new CRMDealsTool());
toolRegistry.register(new DealStakeholdersTool());

/**
 * Get contacts from the CRM
 * @param token OAuth token for CRM access
 * @param search Optional search term to filter contacts by name, email, or company
 * @returns List of contacts from the CRM system
 */
export async function fetchCRMContacts(token: string, search?: string) {
  try {
    const url = new URL("https://www.10x-crm.app/api/contacts/");

    // We'll always get all contacts and filter client-side
    // The API supports a "q" param, but we'll handle filtering ourselves for better control
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch contacts: ${response.status} ${response.statusText}`
      );
    }

    const responseData = await response.json();

    // If no search term, return all contacts
    if (!search || search.trim() === "") {
      return responseData;
    }

    console.log(
      `[fetchCRMContacts] Filtering contacts for search term: ${search}`
    );

    // If we have a search term, filter the contacts
    if (responseData.data && Array.isArray(responseData.data)) {
      const lowerSearch = search.toLowerCase();

      // First look for exact matches (full name, email, company)
      const exactMatches = responseData.data.filter((contact: CRMContact) => {
        return (
          (contact.name && contact.name.toLowerCase() === lowerSearch) ||
          (contact.email && contact.email.toLowerCase() === lowerSearch) ||
          (contact.company && contact.company.toLowerCase() === lowerSearch)
        );
      });

      if (exactMatches.length > 0) {
        console.log(
          `[fetchCRMContacts] Found ${exactMatches.length} exact matches for "${search}"`
        );
        return {
          data: exactMatches,
          pagination: responseData.pagination,
        };
      }

      // If no exact matches, try partial name matching
      // Check for first name/last name partial matches
      const nameParts = lowerSearch.split(" ");
      const partialMatches = responseData.data.filter((contact: CRMContact) => {
        if (!contact.name) return false;

        const contactNameLower = contact.name.toLowerCase();
        const contactNameParts = contactNameLower.split(" ");

        // Check if any part of the search matches any part of the contact name
        return nameParts.some((searchPart) => {
          // Only consider parts with 2+ characters to avoid false matches
          if (searchPart.length < 2) return false;

          // Check if the search part is found in any part of the contact name
          return contactNameParts.some(
            (namePart) =>
              namePart.includes(searchPart) || searchPart.includes(namePart)
          );
        });
      });

      if (partialMatches.length > 0) {
        console.log(
          `[fetchCRMContacts] Found ${partialMatches.length} partial name matches for "${search}"`
        );
        return {
          data: partialMatches,
          pagination: responseData.pagination,
          partialMatches: true,
        };
      }

      // If still no matches, try broader search across all fields
      const broadMatches = responseData.data.filter((contact: CRMContact) => {
        return (
          (contact.name && contact.name.toLowerCase().includes(lowerSearch)) ||
          (contact.email &&
            contact.email.toLowerCase().includes(lowerSearch)) ||
          (contact.company &&
            contact.company.toLowerCase().includes(lowerSearch))
        );
      });

      console.log(
        `[fetchCRMContacts] Found ${broadMatches.length} broad matches for "${search}"`
      );

      // Return the filtered data with the same structure
      return {
        data: broadMatches,
        pagination: responseData.pagination,
      };
    }

    return responseData;
  } catch (error) {
    console.error("Error fetching contacts from CRM:", error);
    throw error;
  }
}

/**
 * Get deals from the CRM
 * @param token OAuth token for CRM access
 * @param dealId Optional specific deal ID to retrieve
 * @param contactId Optional contact ID to filter deals by contact
 * @param stage Optional deal stage to filter by (discovery, proposal, negotiation, closed_won, closed_lost)
 * @param companyName Optional company name to search for in deals
 * @returns List of deals or a specific deal from the CRM system
 */
export async function fetchCRMDeals(
  token: string,
  dealId?: string,
  contactId?: string,
  stage?: string,
  companyName?: string
) {
  try {
    const url = new URL("https://www.10x-crm.app/api/deals");

    // Add query parameters if provided
    if (dealId) {
      url.searchParams.append("id", dealId);
    }

    if (contactId) {
      url.searchParams.append("customerId", contactId);
    }

    if (stage) {
      url.searchParams.append("stage", stage);
    }

    // Add company name search parameter
    if (companyName) {
      console.log(`Adding company filter for "${companyName}"`);
      url.searchParams.append("company", companyName);
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      console.error(
        `CRM API Error Response: ${response.status} ${response.statusText}`
      );

      // Try to get the response body as text to see what's being returned
      const responseText = await response.text();
      console.error(
        `CRM API Error Response Body: ${responseText.substring(0, 500)}${
          responseText.length > 500 ? "..." : ""
        }`
      );

      throw new Error(
        `Failed to fetch deals: ${response.status} ${response.statusText}`
      );
    }

    // Clone the response for debugging
    const responseClone = response.clone();

    try {
      const data = await response.json();
      console.log(
        `CRM API Response Success - data received with ${
          data.deals ? data.deals.length : 0
        } deals`
      );
      return data;
    } catch (parseError: any) {
      // Explicitly type the parseError
      // If JSON parsing fails, get the response as text to see what's being returned
      const responseText = await responseClone.text();
      console.error(`CRM API JSON Parse Error: ${parseError.message}`);
      console.error(
        `CRM API Raw Response: ${responseText.substring(0, 500)}${
          responseText.length > 500 ? "..." : ""
        }`
      );

      // Check if the response starts with HTML (common sign of authentication issues)
      if (
        responseText.trim().startsWith("<!DOCTYPE") ||
        responseText.trim().startsWith("<html")
      ) {
        console.error(
          `ERROR: Received HTML instead of JSON - likely an authentication issue or server error`
        );
        console.error(
          `First 100 characters: ${responseText.substring(0, 100)}`
        );
      }

      throw parseError;
    }
  } catch (error) {
    console.error("Error fetching deals from CRM:", error);
    if (error instanceof Error) {
      console.error(`Error details: ${error.message}`);
      console.error(`Error stack: ${error.stack}`);
    }
    throw error;
  }
}

/**
 * Get stakeholders for a deal - convenience function to extract all relevant contacts for a deal
 * @param token OAuth token for CRM access
 * @param dealId Deal ID to get stakeholders for
 * @returns List of stakeholders (deal owner, primary contact, and any additional contacts) for the deal
 */
export async function fetchDealStakeholders(token: string, dealId: string) {
  try {
    // First get the deal details
    const dealData = await fetchCRMDeals(token, dealId);

    if (!dealData?.data || dealData.data.length === 0) {
      throw new Error(`Deal with ID ${dealId} not found`);
    }

    const deal = dealData.data[0] as CRMDealDetails;
    const stakeholders: Stakeholder[] = [];

    // Add the primary customer contact
    if (deal.customer) {
      stakeholders.push({
        type: "customer",
        id: deal.customer.id,
        name: deal.customer.name,
        email: deal.customer.email,
        company: deal.customer.company,
        role: "Primary Contact",
      });
    }

    // Add the deal owner
    if (deal.owner) {
      stakeholders.push({
        type: "internal",
        id: deal.owner.id,
        name: deal.owner.name,
        email: deal.owner.email,
        position: deal.owner.position,
        role: "Deal Owner",
      });
    }

    // Get any additional contacts mentioned in activities
    const mentionedContacts = new Set<string>();
    if (deal.activities && deal.activities.length > 0) {
      // Track unique customer names mentioned in activities that aren't the primary contact
      deal.activities.forEach((activity: CRMActivity) => {
        if (activity.customer && activity.customer !== deal.customer?.name) {
          mentionedContacts.add(activity.customer);
        }
      });
    }

    // If there are other contacts mentioned, fetch their details
    if (mentionedContacts.size > 0) {
      const contacts = await fetchCRMContacts(token);
      if (contacts?.data) {
        contacts.data.forEach((contact: CRMContact) => {
          if (
            mentionedContacts.has(contact.name) &&
            contact.id !== deal.customer?.id
          ) {
            stakeholders.push({
              type: "customer",
              id: contact.id,
              name: contact.name,
              email: contact.email,
              company: contact.company,
              role: "Additional Contact",
            });
          }
        });
      }
    }

    return {
      dealId: deal.id,
      dealName: deal.name,
      stakeholders,
    };
  } catch (error) {
    console.error("Error fetching deal stakeholders:", error);
    throw error;
  }
}
