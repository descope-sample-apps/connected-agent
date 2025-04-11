/**
 * CRM Utility Functions
 * Helper functions for interacting with the CRM API
 */

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

/**
 * Get contacts from the CRM
 * @param token OAuth token for CRM access
 * @param search Optional search term to filter contacts by name, email, or company
 * @returns List of contacts from the CRM system
 */
export async function getContacts(token: string, search?: string) {
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
        Authorization: `Bearer ${token}`,
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
 * @param token OAuth token for CRM access
 * @param dealId Optional specific deal ID to retrieve
 * @param contactId Optional contact ID to filter deals by contact
 * @param stage Optional deal stage to filter by (discovery, proposal, negotiation, closed_won, closed_lost)
 * @returns List of deals or a specific deal from the CRM system
 */
export async function getDeals(
  token: string,
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
        Authorization: `Bearer ${token}`,
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

/**
 * Get stakeholders for a deal - convenience function to extract all relevant contacts for a deal
 * @param token OAuth token for CRM access
 * @param dealId Deal ID to get stakeholders for
 * @returns List of stakeholders (deal owner, primary contact, and any additional contacts) for the deal
 */
export async function getDealStakeholders(token: string, dealId: string) {
  try {
    // First get the deal details
    const dealData = await getDeals(token, dealId);

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
      const contacts = await getContacts(token);
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

/**
 * Search for a contact by name in the CRM
 * @param token OAuth token for CRM access
 * @param name Name to search for
 * @returns Contact information if found, or suggestions for partial matches
 */
export async function searchContact(token: string, name: string) {
  try {
    console.log(`[CRM Utils] Searching for contact with name: ${name}`);

    // Get all contacts from the main contacts endpoint
    const url = new URL("https://www.10x-crm.app/api/contacts");

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      console.error(`[CRM Utils] API error (${response.status}):`, errorText);
      throw new Error(
        `CRM API error: ${response.status} ${response.statusText}`
      );
    }

    // Parse the response and look for a matching contact by name
    const responseData = await response.json();

    if (!responseData.data || !Array.isArray(responseData.data)) {
      console.error("[CRM Utils] Unexpected response format:", responseData);
      throw new Error("Unexpected response format from CRM API");
    }

    console.log(
      `[CRM Utils] Got ${responseData.data.length} contacts, filtering for "${name}"`
    );

    // Check for exact matches first (case-insensitive)
    const exactMatch = responseData.data.find(
      (contact: CRMContact) => contact.name.toLowerCase() === name.toLowerCase()
    );

    // If we have an exact match, prioritize it
    if (exactMatch) {
      console.log(
        `[CRM Utils] Found exact match for "${name}":`,
        exactMatch.name
      );
      return {
        success: true,
        data: {
          contact: exactMatch,
          message: `Found contact information for ${exactMatch.name}.`,
        },
      };
    }

    // Check for partial name matches - first name, last name, etc.
    const nameParts = name.toLowerCase().split(" ");
    const partialMatches = responseData.data.filter((contact: CRMContact) => {
      const contactNameLower = contact.name.toLowerCase();

      // Check if any part of the search name is contained in the contact name
      return nameParts.some(
        (part) =>
          // Only consider parts with 2+ characters to avoid false matches
          part.length >= 2 && contactNameLower.includes(part)
      );
    });

    // If we have partial matches, return them as suggestions
    if (partialMatches.length > 0) {
      console.log(
        `[CRM Utils] Found ${partialMatches.length} partial matches for "${name}"`
      );

      // Get the best match (first one)
      const bestMatch = partialMatches[0];

      // For a single partial match, suggest confirmation
      if (partialMatches.length === 1) {
        return {
          success: true,
          data: {
            partialMatch: true,
            contact: bestMatch,
            message: `I found ${bestMatch.name} (${bestMatch.email}) from ${
              bestMatch.company || "unknown company"
            }. Is this the correct person?`,
            needsConfirmation: true,
          },
        };
      }

      // For multiple matches, return the list with details for confirmation
      return {
        success: true,
        data: {
          partialMatches: true,
          contacts: partialMatches.slice(0, 3), // Limit to top 3 matches
          message: `I found multiple people that might match "${name}":
${partialMatches
  .slice(0, 3)
  .map(
    (c: CRMContact, i: number) =>
      `${i + 1}. ${c.name} (${c.email}) from ${c.company || "unknown company"}`
  )
  .join("\n")}

Which one did you mean?`,
          needsConfirmation: true,
        },
      };
    }

    // No matches found
    console.log(`[CRM Utils] No contacts found for name: ${name}`);
    return {
      success: true,
      data: {
        notFound: true,
        searchedName: name,
        message: `I've searched the CRM system, but no contact was found with the name "${name}".`,
      },
    };
  } catch (error) {
    console.error("[CRM Utils] Error searching for contact:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unknown error searching for contact",
      data: {
        searchError: true,
        message: `I encountered an error while searching for "${name}" in the CRM system.`,
      },
    };
  }
}

/**
 * Create a new contact in the CRM
 * @param token OAuth token for CRM access
 * @param name Contact name
 * @param email Contact email
 * @param phone Optional phone number
 * @param company Optional company name
 * @param title Optional job title
 * @param notes Optional notes about the contact
 * @returns Newly created contact information
 */
export async function createContact(
  token: string,
  name: string,
  email: string,
  phone?: string,
  company?: string,
  title?: string,
  notes?: string
) {
  try {
    console.log(`[CRM Utils] Creating new contact: ${name} (${email})`);

    const response = await fetch("https://www.10x-crm.app/api/contacts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name,
        email,
        phone,
        company,
        title,
        notes,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      console.error(`[CRM Utils] API error (${response.status}):`, errorText);
      throw new Error(
        `Failed to create contact: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    console.log(`[CRM Utils] Contact created:`, data.id);
    return {
      success: true,
      data: {
        contact: data,
        message: `Successfully created a new contact for ${name}.`,
      },
    };
  } catch (error) {
    console.error("[CRM Utils] Error creating contact:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unknown error creating contact",
      data: {
        message: `I encountered an error while trying to create a contact for "${name}" in the CRM system.`,
      },
    };
  }
}
