// Define constants for AI model defaults
export const DEFAULT_CHAT_MODEL = "gpt-3.5-turbo";

// Model settings
export const MODEL_SETTINGS = {
  "gpt-3.5-turbo": {
    temperature: 0.7,
    maxTokens: 4096,
  },
  "gpt-4-turbo": {
    temperature: 0.7,
    maxTokens: 128000,
  },
  "gpt-4o": {
    temperature: 0.7,
    maxTokens: 128000,
  },
};

// Define new CRM tool schemas in the approvedTools array or equivalent
const crmToolSchemas = [
  {
    type: "function",
    function: {
      name: "get_crm_contacts",
      description: "Get contact information from the CRM system",
      parameters: {
        type: "object",
        properties: {
          search: {
            type: "string",
            description:
              "Optional search term to filter contacts by name, email, or company",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_crm_deals",
      description: "Get deal information from the CRM system",
      parameters: {
        type: "object",
        properties: {
          dealId: {
            type: "string",
            description: "Optional specific deal ID to retrieve",
          },
          contactId: {
            type: "string",
            description: "Optional contact ID to filter deals by contact",
          },
          stage: {
            type: "string",
            description:
              "Optional deal stage to filter by (discovery, proposal, negotiation, closed_won, closed_lost)",
            enum: [
              "discovery",
              "proposal",
              "negotiation",
              "closed_won",
              "closed_lost",
            ],
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_deal_stakeholders",
      description:
        "Get all stakeholders (contacts) associated with a specific deal",
      parameters: {
        type: "object",
        properties: {
          dealId: {
            type: "string",
            description: "The deal ID to get stakeholders for",
          },
        },
        required: ["dealId"],
      },
    },
  },
];

// Add these to your APPROVED_TOOLS array or other appropriate place
export const APPROVED_TOOLS = [
  // ... existing tools ...
  ...crmToolSchemas,
];
