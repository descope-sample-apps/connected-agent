import { OpenAPIV3 } from "openapi-types";

interface ScopeRequirement {
  provider: string;
  scopes: string[];
  operation: string;
}

interface OperationMapping {
  path: string;
  method: string;
  operationId?: string;
}

// Cache for OpenAPI specs to avoid repeated fetches
const specCache: Record<string, OpenAPIV3.Document> = {};

/**
 * Type guard to check if an object is an OperationObject
 */
function isOperationObject(obj: unknown): obj is OpenAPIV3.OperationObject {
  return (
    typeof obj === "object" &&
    obj !== null &&
    !Array.isArray(obj) &&
    "responses" in obj
  );
}

/**
 * Type guard to check if an object is a SecuritySchemeObject
 */
function isSecuritySchemeObject(
  obj: OpenAPIV3.ReferenceObject | OpenAPIV3.SecuritySchemeObject
): obj is OpenAPIV3.SecuritySchemeObject {
  return "type" in obj;
}

/**
 * Fetches and caches OpenAPI spec for a provider
 */
export async function getOpenAPISpec(
  provider: string
): Promise<OpenAPIV3.Document | null> {
  if (specCache[provider]) {
    return specCache[provider];
  }

  const specUrls: Record<string, string> = {
    "google-calendar":
      "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest",
    "google-docs": "https://docs.googleapis.com/$discovery/rest?version=v1",
    zoom: "https://marketplace.zoom.us/docs/api-reference/zoom-api/openapi.json",
    salesforce:
      "https://developer.salesforce.com/docs/openapi/runtime/rest.json",
    hubspot:
      "https://api.hubspot.com/api-catalog-public/v1/apis/crm/v3/openapi.json",
    // Add more provider spec URLs as needed
  };

  if (!specUrls[provider]) {
    console.warn(`No OpenAPI spec URL defined for provider: ${provider}`);
    return null;
  }

  try {
    const response = await fetch(specUrls[provider]);
    if (!response.ok) {
      throw new Error(`Failed to fetch OpenAPI spec: ${response.statusText}`);
    }

    const spec = (await response.json()) as OpenAPIV3.Document;
    specCache[provider] = spec;
    return spec;
  } catch (error) {
    console.error(`Error fetching OpenAPI spec for ${provider}:`, error);
    return null;
  }
}

/**
 * Generates operation mappings from OpenAPI spec
 */
function generateOperationMappings(
  spec: OpenAPIV3.Document,
  provider: string
): Record<string, OperationMapping> {
  const mappings: Record<string, OperationMapping> = {};

  // Iterate through all paths in the spec
  Object.entries(spec.paths || {}).forEach(([path, pathObj]) => {
    // Type assertion for pathObj
    const pathItem = pathObj as OpenAPIV3.PathItemObject;

    // Get all HTTP methods for this path
    const methods = Object.keys(pathItem).filter((method) =>
      ["get", "post", "put", "patch", "delete", "head", "options"].includes(
        method.toLowerCase()
      )
    ) as Array<keyof OpenAPIV3.PathItemObject>;

    // For each method, create a mapping
    methods.forEach((method) => {
      const operation = pathItem[method];
      if (!operation || !isOperationObject(operation)) return;

      // Generate operation name from path and method
      const operationName = generateOperationName(
        path,
        method.toString(),
        operation
      );

      // Store the mapping
      mappings[`${provider}:${operationName}`] = {
        path,
        method: method.toString().toLowerCase(),
        operationId: operation.operationId,
      };
    });
  });

  return mappings;
}

/**
 * Generates a friendly operation name from path and method
 */
function generateOperationName(
  path: string,
  method: string,
  operation: OpenAPIV3.OperationObject
): string {
  // If operation has an operationId, use it
  if (operation.operationId) {
    return operation.operationId;
  }

  // Otherwise generate from path and method
  const pathParts = path
    .split("/")
    .filter(Boolean)
    .map((part) => part.replace(/[{}]/g, "")); // Remove path parameters

  // Get the last resource name from the path
  const resource = pathParts[pathParts.length - 1];

  // Generate operation name based on HTTP method
  const action = method.toLowerCase();
  let operationName = "";

  switch (action) {
    case "get":
      operationName =
        pathParts.length > 1 ? `${resource}.list` : `${resource}.get`;
      break;
    case "post":
      operationName = `${resource}.create`;
      break;
    case "put":
      operationName = `${resource}.update`;
      break;
    case "patch":
      operationName = `${resource}.update`;
      break;
    case "delete":
      operationName = `${resource}.delete`;
      break;
    default:
      operationName = `${resource}.${action}`;
  }

  return operationName;
}

/**
 * Extracts required scopes from an OpenAPI operation
 */
export function getRequiredScopesFromOperation(
  spec: OpenAPIV3.Document,
  path: string,
  method: string
): string[] {
  try {
    const pathObj = spec.paths[path];
    if (!pathObj) return [];

    const pathItem = pathObj as OpenAPIV3.PathItemObject;
    const operation =
      pathItem[method.toLowerCase() as keyof OpenAPIV3.PathItemObject];
    if (!operation || !isOperationObject(operation)) return [];

    // Get all security requirements that apply to this operation
    const securityRequirements: OpenAPIV3.SecurityRequirementObject[] = [];

    // 1. Check operation-specific security requirements
    if (operation.security) {
      securityRequirements.push(...operation.security);
    }

    // 2. Check path-level security requirements
    if ("security" in pathItem && Array.isArray(pathItem.security)) {
      securityRequirements.push(...pathItem.security);
    }

    // 3. Check global security requirements
    if (spec.security && Array.isArray(spec.security)) {
      securityRequirements.push(...spec.security);
    }

    // Extract scopes from all security requirements
    const scopes: string[] = [];
    securityRequirements.forEach((requirement) => {
      Object.entries(requirement).forEach(([scheme, schemeScopes]) => {
        const securityScheme = spec.components?.securitySchemes?.[scheme];
        if (
          securityScheme &&
          isSecuritySchemeObject(securityScheme) &&
          securityScheme.type === "oauth2"
        ) {
          // Add scopes from this security requirement
          if (Array.isArray(schemeScopes)) {
            scopes.push(...schemeScopes);
          }

          // Also check if there are any flow-specific scopes defined
          const flows = securityScheme.flows;
          if (flows) {
            // Check authorization code flow
            if (flows.authorizationCode?.scopes) {
              scopes.push(...Object.keys(flows.authorizationCode.scopes));
            }
            // Check implicit flow
            if (flows.implicit?.scopes) {
              scopes.push(...Object.keys(flows.implicit.scopes));
            }
            // Check client credentials flow
            if (flows.clientCredentials?.scopes) {
              scopes.push(...Object.keys(flows.clientCredentials.scopes));
            }
            // Check password flow
            if (flows.password?.scopes) {
              scopes.push(...Object.keys(flows.password.scopes));
            }
          }
        }
      });
    });

    // Remove duplicates and return
    return [...new Set(scopes)];
  } catch (error) {
    console.error("Error extracting scopes from OpenAPI spec:", error);
    return [];
  }
}

/**
 * Gets required scopes for a specific API operation
 */
export async function getRequiredScopes(
  provider: string,
  operation: string
): Promise<string[]> {
  const spec = await getOpenAPISpec(provider);
  if (!spec) {
    // Fallback to default scopes if spec is not available
    return getDefaultScopes(provider);
  }

  // Generate operation mappings from the spec
  const operationMappings = generateOperationMappings(spec, provider);

  // Look up the operation mapping
  const operationDetails = operationMappings[`${provider}:${operation}`];
  if (!operationDetails) {
    console.warn(`No operation mapping found for ${provider}:${operation}`);
    return getDefaultScopes(provider);
  }

  const scopes = getRequiredScopesFromOperation(
    spec,
    operationDetails.path,
    operationDetails.method
  );

  return scopes.length > 0 ? scopes : getDefaultScopes(provider);
}

/**
 * Default scopes as fallback
 */
function getDefaultScopes(provider: string): string[] {
  const scopeMap: Record<string, string[]> = {
    "google-calendar": ["https://www.googleapis.com/auth/calendar"],
    "google-docs": ["https://www.googleapis.com/auth/documents"],
    zoom: ["meeting:write", "meeting:read"],
    salesforce: ["api", "refresh_token"],
    hubspot: ["crm.objects.contacts.read", "crm.objects.deals.read"],
    microsoft: ["Calendars.ReadWrite", "offline_access"],
  };

  return scopeMap[provider] || ["basic"];
}
