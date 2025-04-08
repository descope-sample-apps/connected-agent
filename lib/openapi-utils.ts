import { OpenAPIV3 } from "openapi-types";

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
  console.log(`Getting required scopes for ${provider}:${operation}`);

  // Operation-specific scopes only - no default fallbacks
  const operationScopes: Record<string, Record<string, string[]>> = {
    "google-calendar": {
      "events.list": ["https://www.googleapis.com/auth/calendar.readonly"],
      "events.create": ["https://www.googleapis.com/auth/calendar"],
      connect: ["https://www.googleapis.com/auth/calendar"], // Full access for connection
    },
    "google-docs": {
      "documents.get": ["https://www.googleapis.com/auth/documents.readonly"],
      "documents.create": ["https://www.googleapis.com/auth/documents"],
      connect: ["https://www.googleapis.com/auth/documents"], // Full access for connection
    },
    zoom: {
      "meetings.list": ["meeting:read"],
      "meetings.create": ["meeting:write"],
      connect: ["meeting:read", "meeting:write"], // Both read and write for connection
    },
    "custom-crm": {
      "contacts.list": ["contacts.read"],
      "deals.list": ["deals.read"],
      connect: ["contacts.read", "deals.read"], // Both for connection
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

  // No default scopes - if the operation isn't found, return empty array
  return [];
}
