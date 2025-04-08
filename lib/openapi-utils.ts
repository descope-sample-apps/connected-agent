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

  // Default scopes for common operations
  const defaultScopes: Record<string, Record<string, string[]>> = {
    "google-calendar": {
      "events.list": ["https://www.googleapis.com/auth/calendar.readonly"],
      "events.create": ["https://www.googleapis.com/auth/calendar"],
      default: ["https://www.googleapis.com/auth/calendar.readonly"],
    },
    "google-docs": {
      "documents.get": ["https://www.googleapis.com/auth/documents.readonly"],
      "documents.create": ["https://www.googleapis.com/auth/documents"],
      default: ["https://www.googleapis.com/auth/documents.readonly"],
    },
    zoom: {
      "meetings.list": ["meeting:read"],
      "meetings.create": ["meeting:write"],
      default: ["meeting:read"],
    },
    crm: {
      "contacts.list": ["contacts.read"],
      "deals.list": ["deals.read"],
      default: ["contacts.read", "deals.read"],
    },
  };

  // First check if we have default scopes for this operation
  if (defaultScopes[provider]?.[operation]) {
    return defaultScopes[provider][operation];
  }

  // Otherwise return the default scopes for the provider
  if (defaultScopes[provider]?.["default"]) {
    return defaultScopes[provider]["default"];
  }

  // If no default scopes defined, return empty array
  return [];
}
