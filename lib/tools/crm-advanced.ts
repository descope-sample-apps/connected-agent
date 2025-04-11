import { Tool, ToolConfig, ToolResponse, toolRegistry } from "./base";
import { getOAuthTokenWithScopeValidation } from "../oauth-utils";

/**
 * CRM Contact types
 */
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
}

/**
 * CRM Activity types
 */
export interface CRMActivity {
  id: string;
  type: string;
  customer: string;
  dealId: string;
  date: string;
  notes: string;
  completed: boolean;
}

/**
 * CRM Deal details
 */
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

/**
 * Stakeholder interface
 */
export interface Stakeholder {
  type: "customer" | "internal";
  id: string;
  name: string;
  email: string;
  company?: string;
  position?: string;
  role: string;
}

/**
 * Tool for fetching CRM stakeholders for a specific deal
 */
class CRMStakeholdersTool extends Tool<{
  dealId: string;
}> {
  config: ToolConfig = {
    id: "crm-stakeholders",
    name: "Deal Stakeholders",
    description:
      "Get all stakeholders (contacts) associated with a specific deal",
    scopes: ["contacts:read", "deals:read"],
    requiredFields: ["dealId"],
    optionalFields: [],
    capabilities: [
      "Find all contacts associated with a deal",
      "Identify primary contacts and deal owners",
      "Prepare contact lists for meeting scheduling",
    ],
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
      // Get OAuth token
      const token = await getOAuthTokenWithScopeValidation(
        userId,
        "custom-crm",
        {
          appId: "custom-crm",
          userId,
          scopes: ["contacts:read", "deals:read"],
          operation: "tool_calling",
        }
      );

      if (!token) {
        return {
          success: false,
          error: "CRM authentication required",
          ui: {
            type: "connection_required",
            service: "custom-crm",
            message: "Please connect your CRM to view deal stakeholders",
            connectButton: {
              text: "Connect CRM",
              action: "connection://custom-crm",
            },
          },
        };
      }

      // First get the deal details
      const dealsUrl = new URL("https://www.10x-crm.app/api/deals");
      dealsUrl.searchParams.append("id", data.dealId);

      const dealResponse = await fetch(dealsUrl.toString(), {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!dealResponse.ok) {
        throw new Error(
          `Failed to fetch deal: ${dealResponse.status} ${dealResponse.statusText}`
        );
      }

      const dealData = await dealResponse.json();

      if (!dealData?.data || dealData.data.length === 0) {
        return {
          success: false,
          error: `Deal with ID ${data.dealId} not found`,
        };
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
        const contactsUrl = new URL("https://www.10x-crm.app/api/contacts/");

        const contactsResponse = await fetch(contactsUrl.toString(), {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (!contactsResponse.ok) {
          throw new Error(
            `Failed to fetch contacts: ${contactsResponse.status} ${contactsResponse.statusText}`
          );
        }

        const contacts = await contactsResponse.json();

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
        success: true,
        data: {
          dealId: deal.id,
          dealName: deal.name,
          stakeholders,
        },
      };
    } catch (error) {
      console.error("Error fetching deal stakeholders:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch deal stakeholders",
        ui: {
          type: "connection_required",
          service: "custom-crm",
          message: "There was an error connecting to your CRM",
          connectButton: {
            text: "Reconnect CRM",
            action: "connection://custom-crm",
          },
        },
      };
    }
  }
}

// Register the new tool
toolRegistry.register(new CRMStakeholdersTool());
