// Define types for model configuration
export interface ModelConfig {
  name: string;
  provider: string;
  maxTokens: number;
  supportsFunctions: boolean;
  supportsVision: boolean;
  temperature?: number;
}

// Define constants for AI model defaults
export const DEFAULT_CHAT_MODEL = "gpt-3.5-turbo";

// Configuration flag to control model selection availability
export const ENABLE_MODEL_SELECTION = false;

// Define available models
export const availableModels: Record<string, ModelConfig> = {
  "gpt-3.5-turbo": {
    name: "GPT-3.5 Turbo",
    provider: "OpenAI",
    maxTokens: 4096,
    supportsFunctions: true,
    supportsVision: false,
  },
};

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
