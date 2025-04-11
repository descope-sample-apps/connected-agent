/**
 * Get contacts from the CRM
 * @param search Optional search term to filter contacts by name, email, or company
 * @returns List of contacts from the CRM system
 */
export async function getContacts(search?: string) {
  try {
    const url = new URL("https://www.10x-crm.app/api/contacts/");

    // Add search parameter if provided
    if (search) {
      url.searchParams.append("q", search);
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.CRM_API_KEY}`,
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch contacts: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching contacts from CRM:", error);
    throw error;
  }
}

/**
 * Get deals from the CRM
 * @param dealId Optional specific deal ID to retrieve
 * @param contactId Optional contact ID to filter deals by contact
 * @param stage Optional deal stage to filter by (discovery, proposal, negotiation, closed_won, closed_lost)
 * @returns List of deals or a specific deal from the CRM system
 */
export async function getDeals(
  dealId?: string,
  contactId?: string,
  stage?: string
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

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.CRM_API_KEY}`,
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch deals: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching deals from CRM:", error);
    throw error;
  }
}

// Define types for CRM data
interface CRMContact {
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
  deals?: CRMDeal[];
}

interface CRMActivity {
  id: string;
  type: string;
  customer: string;
  dealId: string;
  date: string;
  notes: string;
  completed: boolean;
}

interface CRMDeal {
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
 * Get stakeholders for a deal - convenience function to extract all relevant contacts for a deal
 * @param dealId Deal ID to get stakeholders for
 * @returns List of stakeholders (deal owner, primary contact, and any additional contacts) for the deal
 */
export async function getDealStakeholders(dealId: string) {
  try {
    // First get the deal details
    const dealData = await getDeals(dealId);

    if (!dealData?.data || dealData.data.length === 0) {
      throw new Error(`Deal with ID ${dealId} not found`);
    }

    const deal = dealData.data[0] as CRMDeal;
    const stakeholders = [];

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
      const contacts = await getContacts();
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
