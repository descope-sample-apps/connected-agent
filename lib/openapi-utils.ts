import { OpenAPIV3 } from "openapi-types";
import { DEFAULT_SCOPES } from "./oauth-utils";
import { toolRegistry } from "./tools/base";

// Cache for OpenAPI specs to avoid repeated fetches
const specCache: Record<string, OpenAPIV3.Document> = {};

/**
 * Fetches and caches OpenAPI spec for a provider
 */
export async function getOpenAPISpec(
  provider: string
): Promise<OpenAPIV3.Document | null> {
  console.log(`getOpenAPISpec called for provider: ${provider}`);

  if (specCache[provider]) {
    console.log(`Using cached OpenAPI spec for ${provider}`);
    return specCache[provider];
  }

  const specUrls: Record<string, string> = {
    "google-calendar":
      "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest",
    "google-docs": "https://www.googleapis.com/discovery/v1/apis/docs/v1/rest",
    "google-drive":
      "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest",
    zoom: "https://raw.githubusercontent.com/zoom/api-spec/master/openapi.json",
  };

  if (!specUrls[provider]) {
    console.warn(`No OpenAPI spec URL defined for provider: ${provider}`);
    return null;
  }

  try {
    const response = await fetch(specUrls[provider]);
    if (!response.ok) {
      console.warn(
        `Failed to fetch OpenAPI spec for ${provider}: ${response.statusText}`
      );
      return null;
    }

    const spec = (await response.json()) as OpenAPIV3.Document;
    console.log(`Successfully fetched OpenAPI spec for ${provider}`);
    specCache[provider] = spec;
    return spec;
  } catch (error) {
    console.error(`Error fetching OpenAPI spec for ${provider}:`, error);
    return null;
  }
}

/**
 * Gets required scopes for an operation from OpenAPI spec
 */
export async function getRequiredScopes(
  provider: string,
  operation: string
): Promise<string[]> {
  // Operation-specific scopes only - no default fallbacks
  const operationScopes: Record<string, Record<string, string[]>> = {
    "google-calendar": {
      "events.list": ["https://www.googleapis.com/auth/calendar"],
      "events.create": ["https://www.googleapis.com/auth/calendar"],
      connect: ["https://www.googleapis.com/auth/calendar"],
    },
    // "google-docs": {
    //   "documents.get": ["https://www.googleapis.com/auth/drive.file"],
    //   "documents.create": ["https://www.googleapis.com/auth/drive.file"],
    //   connect: ["https://www.googleapis.com/auth/drive.file"],
    // },
    "google-meet": {
      "meetings.space": [
        "https://www.googleapis.com/auth/meetings.space.created",
      ],
      "meetings.space.readonly": [
        "https://www.googleapis.com/auth/meetings.space.readonly",
      ],
      connect: [
        "https://www.googleapis.com/auth/calendar",
        "https://www.googleapis.com/auth/meetings.space.created",
      ],
    },
    "custom-crm": {
      "contacts.list": ["contacts.read"],
      "deals.list": ["deals.read"],
      connect: ["openid", "contacts:read", "deals:read"],
    },
    slack: {
      "chat:write": ["chat:write"],
      "channels:manage": ["channels:manage"],
      "users:read": ["users:read"],
      connect: ["chat:write", "channels:manage", "users:read"],
    },
    linkedin: {
      r_emailaddress: ["r_emailaddress"],
      r_basicprofile: ["r_basicprofile"],
      w_member_social: ["w_member_social"],
      connect: ["r_emailaddress", "r_basicprofile", "w_member_social"],
    },
  };

  // Check if we have scopes for this specific operation
  if (operationScopes[provider]?.[operation]) {
    return operationScopes[provider][operation];
  }

  // If the operation is 'connect' but not explicitly defined, try to provide reasonable connect scopes
  if (operation === "connect" && operationScopes[provider]) {
    // Build a combined set of scopes for connection
    const allScopesForProvider = Object.values(
      operationScopes[provider]
    ).flat();

    // Remove duplicates using Set
    const uniqueScopes = [...new Set(allScopesForProvider)];

    console.log(`Built connect scopes for ${provider}:`, uniqueScopes);
    return uniqueScopes;
  }

  // Return default scopes for the provider if available, otherwise empty array
  if (DEFAULT_SCOPES[provider]) {
    return DEFAULT_SCOPES[provider];
  }

  // If no default scopes are found, return empty array
  console.log(
    `No scopes found for ${provider}:${operation}, returning empty array`
  );
  return [];
}

/**
 * Gets required scopes with enhanced logic:
 * 1. First tries to get scopes from the tool registry if toolId is provided
 * 2. Then falls back to hardcoded operation-specific scopes
 * 3. Finally falls back to default scopes for the provider
 */
export async function getToolScopes(
  provider: string,
  operation: string,
  toolId?: string
): Promise<string[]> {
  console.log(
    `[getToolScopes] Getting scopes for ${provider}:${operation}, toolId: ${
      toolId || "none"
    }`
  );

  // If a toolId is provided, try to get scopes from the tool registry first
  if (toolId) {
    const toolScopes = toolRegistry.getToolScopesForOperation(
      toolId,
      operation
    );
    if (toolScopes && toolScopes.length > 0) {
      console.log(
        `[getToolScopes] Using tool registry scopes for ${toolId}:${operation}:`,
        toolScopes
      );
      return toolScopes;
    }
  }

  // Then try operation-specific hardcoded scopes
  const operationScopes = await getRequiredScopes(provider, operation);
  if (operationScopes && operationScopes.length > 0) {
    console.log(
      `[getToolScopes] Using operation-specific scopes for ${provider}:${operation}:`,
      operationScopes
    );
    return operationScopes;
  }

  // Finally fall back to default scopes for the provider
  if (DEFAULT_SCOPES[provider]) {
    console.log(
      `[getToolScopes] Using default scopes for ${provider}:`,
      DEFAULT_SCOPES[provider]
    );
    return DEFAULT_SCOPES[provider];
  }

  // If no scopes found anywhere, return empty array
  console.log(
    `[getToolScopes] No scopes found for ${provider}:${operation}, returning empty array`
  );
  return [];
}
