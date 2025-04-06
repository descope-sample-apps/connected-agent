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

  const specUrl = specUrls[provider];
  console.log(`Fetching OpenAPI spec from: ${specUrl}`);

  try {
    const response = await fetch(specUrl);
    console.log(
      `OpenAPI spec fetch response status: ${response.status} ${response.statusText}`
    );

    if (!response.ok) {
      console.warn(
        `Failed to fetch OpenAPI spec for ${provider}: ${response.statusText}`
      );

      // For Zoom, provide a fallback minimal spec to avoid errors
      if (provider === "zoom") {
        console.log("Using fallback minimal spec for Zoom");
        // Create a minimal valid OpenAPI spec for Zoom
        const fallbackSpec = {
          openapi: "3.0.0",
          info: { title: "Zoom API", version: "1.0.0" },
          paths: {},
          components: {
            securitySchemes: {
              oauth2: {
                type: "oauth2",
                flows: {
                  authorizationCode: {
                    authorizationUrl: "https://zoom.us/oauth/authorize",
                    tokenUrl: "https://zoom.us/oauth/token",
                    scopes: {
                      "meeting:read": "View meetings",
                      "meeting:write": "Create and manage meetings",
                    },
                  },
                },
              },
            },
          },
        } as unknown as OpenAPIV3.Document;

        specCache[provider] = fallbackSpec;
        return fallbackSpec;
      }

      return null;
    }

    const spec = (await response.json()) as OpenAPIV3.Document;
    console.log(`Successfully fetched OpenAPI spec for ${provider}`);
    specCache[provider] = spec;
    return spec;
  } catch (error) {
    console.error(`Error fetching OpenAPI spec for ${provider}:`, error);

    // For Zoom, provide a fallback minimal spec to avoid errors
    if (provider === "zoom") {
      console.log("Using fallback minimal spec for Zoom due to error");
      // Create a minimal valid OpenAPI spec for Zoom
      const fallbackSpec = {
        openapi: "3.0.0",
        info: { title: "Zoom API", version: "1.0.0" },
        paths: {},
        components: {
          securitySchemes: {
            oauth2: {
              type: "oauth2",
              flows: {
                authorizationCode: {
                  authorizationUrl: "https://zoom.us/oauth/authorize",
                  tokenUrl: "https://zoom.us/oauth/token",
                  scopes: {
                    "meeting:read": "View meetings",
                    "meeting:write": "Create and manage meetings",
                  },
                },
              },
            },
          },
        },
      } as unknown as OpenAPIV3.Document;

      specCache[provider] = fallbackSpec;
      return fallbackSpec;
    }

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
  appId: string,
  operation: string
): Promise<string[]> {
  console.log(`Getting required scopes for ${appId}:${operation}`);

  // For connection checking, we don't need scopes
  if (operation === "check_connection") {
    console.log(
      `Operation is "check_connection", returning empty scopes array`
    );
    return [];
  }

  console.log(`Fetching OpenAPI spec for ${appId}...`);
  const spec = await getOpenAPISpec(appId);
  if (!spec) {
    console.warn(`No OpenAPI spec found for ${appId}`);
    return [];
  }
  console.log(`OpenAPI spec found for ${appId}`);

  console.log(`Getting operation mapping for ${appId}:${operation}...`);
  const operationMapping = await getOperationMapping(appId, operation);
  if (!operationMapping) {
    console.warn(`No operation mapping found for ${appId}:${operation}`);
    return [];
  }
  console.log(`Operation mapping found:`, operationMapping);

  console.log(`Getting scopes from operation...`);
  const scopes = getScopesFromOperation(spec, operationMapping);
  if (!scopes || scopes.length === 0) {
    console.warn(`No scopes found for operation ${operation} in app ${appId}`);
    return [];
  }
  console.log(`Scopes found:`, scopes);

  return scopes;
}

async function getOperationMapping(appId: string, operation: string) {
  const spec = await getOpenAPISpec(appId);
  if (!spec) return null;
  const operationMappings = generateOperationMappings(spec, appId);
  return operationMappings[`${appId}:${operation}`];
}

function getScopesFromOperation(spec: any, operationMapping: any) {
  return getRequiredScopesFromOperation(
    spec,
    operationMapping.path,
    operationMapping.method
  );
}
