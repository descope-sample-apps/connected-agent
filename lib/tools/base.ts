import { toolLogger } from "../logger";
import { getCurrentDateContext } from "../date-utils";

export interface ToolResponse {
  success: boolean;
  status?: "success" | "error";
  data?: any;
  error?: string;
  needsInput?: {
    field: string;
    message: string;
    options?: string[];
    currentValue?: any;
  };
  ui?: {
    type: string;
    service?: string;
    message?: string;
    connectButton?: {
      text: string;
      action: string;
    };
    alternativeMessage?: string;
    requiredScopes?: string[];
    currentScopes?: string[];
    toolId?: string;
  };
}

export interface ToolConfig {
  id: string;
  name: string;
  description: string;
  scopes: string[];
  requiredFields: string[];
  optionalFields?: string[];
  capabilities?: string[];
  parameters?: Record<string, any>;
  oauthConfig?: {
    provider?: string; // The OAuth provider ID (e.g., "custom-crm", "google-calendar")
    defaultScopes?: string[]; // Default scopes to request when no scopes are specified
    requiredScopes?: string[]; // Scopes that are always required
    scopeMapping?: Record<string, string[]>; // Map operations to required scopes
  };
}

export abstract class Tool<InputType> {
  abstract config: ToolConfig;

  abstract validate(data: InputType): ToolResponse | null;

  abstract execute(userId: string, data: InputType): Promise<ToolResponse>;

  // Helper method to prompt for date clarification with current date context
  promptForDateClarification(vagueDateText: string): string {
    const context = getCurrentDateContext();
    return `I see you mentioned "${vagueDateText}". Today is ${context.currentDate}. Could you please clarify exactly when you'd like to schedule this?`;
  }

  async executeWithLogging(
    userId: string,
    data: InputType
  ): Promise<ToolResponse> {
    const startTime = Date.now();
    const toolName = this.config.name;

    toolLogger.info(`Tool execution started: ${toolName}`, {
      userId,
      toolId: this.config.id,
      input: this.sanitizeInput(data),
    });

    try {
      // Validate input data
      const validationError = this.validate(data);
      if (validationError) {
        toolLogger.warn(`Tool validation failed: ${toolName}`, {
          userId,
          toolId: this.config.id,
          error: validationError.error,
          executionTimeMs: Date.now() - startTime,
        });
        return validationError;
      }

      // Execute the tool
      const result = await this.execute(userId, data);

      const executionTime = Date.now() - startTime;

      if (result.success) {
        toolLogger.info(`Tool execution succeeded: ${toolName}`, {
          userId,
          toolId: this.config.id,
          executionTimeMs: executionTime,
          output: this.sanitizeOutput(result.data),
        });
      } else {
        toolLogger.warn(`Tool execution failed: ${toolName}`, {
          userId,
          toolId: this.config.id,
          error: result.error,
          executionTimeMs: executionTime,
        });
      }

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      toolLogger.error(`Tool execution error: ${toolName}`, {
        userId,
        toolId: this.config.id,
        error: errorMessage,
        executionTimeMs: executionTime,
      });

      return {
        success: false,
        error: `Tool execution error: ${errorMessage}`,
        ui: {
          type: "connection_required",
          service: this.config.id.split("-")[0] || "unknown",
          message: `Please connect your ${this.config.name} account to use this feature.`,
          connectButton: {
            text: `Connect ${this.config.name}`,
            action: `connection://${this.config.id.split("-")[0] || "unknown"}`,
          },
        },
      };
    }
  }

  // Helper to sanitize sensitive data from logs
  private sanitizeInput(data: InputType): any {
    // Remove sensitive data before logging
    if (!data) return {};

    const sanitized = { ...(data as any) };

    // Remove specific sensitive fields if present
    const sensitiveFields = [
      "accessToken",
      "refreshToken",
      "password",
      "secret",
    ];
    sensitiveFields.forEach((field) => {
      if (field in sanitized) {
        sanitized[field] = "[REDACTED]";
      }
    });

    return sanitized;
  }

  // Helper to sanitize large outputs for logs
  private sanitizeOutput(data: any): any {
    if (!data) return {};

    // For arrays, summarize if too large
    if (Array.isArray(data)) {
      if (data.length > 5) {
        return {
          type: "array",
          length: data.length,
          sample: data.slice(0, 3),
        };
      }
      return data;
    }

    // For objects, handle specially
    if (typeof data === "object") {
      // Remove particularly large fields that don't need full logging
      const summarizedData = { ...data };
      const largeFields = ["content", "description", "body", "text"];

      largeFields.forEach((field) => {
        if (
          field in summarizedData &&
          typeof summarizedData[field] === "string" &&
          summarizedData[field].length > 100
        ) {
          summarizedData[field] = `${summarizedData[field].substring(
            0,
            100
          )}... [${summarizedData[field].length} chars]`;
        }
      });

      return summarizedData;
    }

    return data;
  }
}

class ToolRegistry {
  private tools: Map<string, Tool<any>> = new Map();

  register<T>(tool: Tool<T>) {
    console.log(`[ToolRegistry] Registering tool: ${tool.config.name}`, {
      toolId: tool.config.id,
      capabilities: tool.config.capabilities || [],
    });
    toolLogger.info(`Registering tool: ${tool.config.name}`, {
      toolId: tool.config.id,
      capabilities: tool.config.capabilities || [],
    });
    this.tools.set(tool.config.id, tool);
  }

  getTool<T>(id: string): Tool<T> | undefined {
    console.log(`[ToolRegistry] Getting tool by ID: ${id}`);
    const tool = this.tools.get(id) as Tool<T>;
    console.log(`[ToolRegistry] Tool lookup result:`, {
      id,
      found: !!tool,
      name: tool?.config?.name,
    });
    return tool;
  }

  getAllTools(): Tool<any>[] {
    console.log(`[ToolRegistry] Getting all tools, count: ${this.tools.size}`);
    return Array.from(this.tools.values());
  }

  getToolConfigs(): ToolConfig[] {
    console.log(`[ToolRegistry] Getting all tool configs`);
    return this.getAllTools().map((tool) => tool.config);
  }

  // Find a tool by capability or description keyword
  findToolByCapability(keyword: string): Tool<any> | undefined {
    console.log(
      `[ToolRegistry] Searching for tool by capability: "${keyword}"`
    );

    const tools = this.getAllTools();
    for (const tool of tools) {
      // Check in capabilities
      if (
        tool.config.capabilities?.some((cap) =>
          cap.toLowerCase().includes(keyword.toLowerCase())
        )
      ) {
        console.log(
          `[ToolRegistry] Found tool by capability: ${tool.config.name}`
        );
        return tool;
      }

      // Check in description
      if (
        tool.config.description.toLowerCase().includes(keyword.toLowerCase())
      ) {
        console.log(
          `[ToolRegistry] Found tool by description: ${tool.config.name}`
        );
        return tool;
      }

      // Check in name
      if (tool.config.name.toLowerCase().includes(keyword.toLowerCase())) {
        console.log(`[ToolRegistry] Found tool by name: ${tool.config.name}`);
        return tool;
      }
    }

    console.log(`[ToolRegistry] No tool found for capability: "${keyword}"`);
    return undefined;
  }

  // Get OAuth configuration for a tool
  getToolOAuthConfig(toolId: string): {
    provider: string;
    defaultScopes: string[];
    requiredScopes: string[];
    scopeMapping?: Record<string, string[]>;
  } | null {
    console.log(`[ToolRegistry] Getting OAuth config for tool: ${toolId}`);

    const tool = this.getTool(toolId);
    if (!tool) {
      console.error(
        `[ToolRegistry] Tool not found for OAuth config: ${toolId}`
      );
      return null;
    }

    // If the tool has no OAuth config, return null
    if (!tool.config.oauthConfig) {
      console.log(`[ToolRegistry] No OAuth config for tool: ${toolId}`);
      return null;
    }

    // Extract the provider ID from the tool ID if not specified
    const provider = tool.config.oauthConfig.provider || toolId.split("-")[0];

    return {
      provider,
      defaultScopes: tool.config.oauthConfig.defaultScopes || [],
      requiredScopes: tool.config.oauthConfig.requiredScopes || [],
      scopeMapping: tool.config.oauthConfig.scopeMapping,
    };
  }

  // Get scopes for a specific operation on a tool
  getToolScopesForOperation(toolId: string, operation: string): string[] {
    const oauthConfig = this.getToolOAuthConfig(toolId);
    if (!oauthConfig) {
      return [];
    }

    // Check if there's a scope mapping for this operation
    if (oauthConfig.scopeMapping && oauthConfig.scopeMapping[operation]) {
      return [
        ...oauthConfig.requiredScopes,
        ...oauthConfig.scopeMapping[operation],
      ];
    }

    // Fall back to required + default scopes
    return [...oauthConfig.requiredScopes, ...oauthConfig.defaultScopes];
  }

  // Execute a tool with proper logging
  async executeTool<T>(
    toolId: string,
    userId: string,
    data: T
  ): Promise<ToolResponse> {
    console.log(`[ToolRegistry] Executing tool: ${toolId}`, {
      userId,
      dataKeys: data ? Object.keys(data) : [],
      dataType: typeof data,
    });

    const tool = this.getTool<T>(toolId);

    if (!tool) {
      console.error(`[ToolRegistry] Tool not found: ${toolId}`);
      toolLogger.error(`Tool not found: ${toolId}`, { userId });
      return {
        success: false,
        error: `Tool with ID '${toolId}' not found`,
      };
    }

    console.log(`[ToolRegistry] Found tool to execute: ${tool.config.name}`);
    return tool.executeWithLogging(userId, data);
  }
}

export const toolRegistry = new ToolRegistry();

// Standard OAuth providers supported by the application
export type OAuthProvider =
  | "google-calendar"
  | "google-docs"
  | "google-meet"
  | "custom-crm"
  | "slack"
  | "zoom"
  | "linkedin";

// Create standardized connection request for OAuth providers
export function createConnectionRequest(options: {
  provider: OAuthProvider;
  isReconnect?: boolean;
  requiredScopes?: string[];
  currentScopes?: string[];
  customMessage?: string;
  toolId?: string;
  operation?: string;
}): ToolResponse {
  const {
    provider,
    isReconnect = false,
    requiredScopes: explicitScopes,
    currentScopes = [],
    customMessage,
    toolId,
    operation,
  } = options;

  // Get scopes from the tool registry if a toolId is provided and no explicit scopes
  let requiredScopes = explicitScopes;
  if ((!requiredScopes || requiredScopes.length === 0) && toolId) {
    console.log(
      `[createConnectionRequest] No explicit scopes provided, looking up tool scopes for ${toolId}`
    );

    if (operation) {
      // Get scopes specific to the operation
      requiredScopes = toolRegistry.getToolScopesForOperation(
        toolId,
        operation
      );
      console.log(
        `[createConnectionRequest] Using operation-specific scopes for ${toolId}:${operation}:`,
        requiredScopes
      );
    } else {
      // Get default tool scopes
      const oauthConfig = toolRegistry.getToolOAuthConfig(toolId);
      if (oauthConfig) {
        requiredScopes = [
          ...oauthConfig.requiredScopes,
          ...oauthConfig.defaultScopes,
        ];
        console.log(
          `[createConnectionRequest] Using default tool scopes for ${toolId}:`,
          requiredScopes
        );
      }
    }
  }

  console.log("[createConnectionRequest] Creating request:", {
    provider,
    isReconnect,
    hasRequiredScopes: !!requiredScopes && requiredScopes.length > 0,
    requiredScopesCount: requiredScopes?.length || 0,
    currentScopesCount: currentScopes.length,
    hasCustomMessage: !!customMessage,
    usedToolId: !!toolId,
    operation: operation || "none",
  });

  // Format provider name for display
  const getDisplayName = (provider: OAuthProvider): string => {
    switch (provider) {
      case "google-calendar":
        return "Google Calendar";
      case "google-docs":
        return "Google Docs";
      case "google-meet":
        return "Google Meet";
      case "custom-crm":
        return "CRM";
      case "slack":
        return "Slack";
      case "zoom":
        return "Zoom";
      case "linkedin":
        return "LinkedIn";
      default:
        return String(provider).replace(/-/g, " ");
    }
  };

  const displayName = getDisplayName(provider);

  // Create appropriate messages based on connection type
  const primaryMessage =
    customMessage ||
    (isReconnect
      ? `Additional permissions are required for ${displayName}.`
      : `Please connect your ${displayName} account to continue.`);

  let alternativeMessage =
    "This will allow the assistant to access the necessary data to fulfill your request.";

  // Add scope information if available
  if (requiredScopes && requiredScopes.length > 0) {
    const scopeText = requiredScopes
      .map((scope) => scope.split("/").pop() || scope)
      .join(", ");

    alternativeMessage = `The following permissions are needed: ${scopeText}`;
  }

  // Create the button text
  const buttonText = isReconnect
    ? `Reconnect ${displayName}`
    : `Connect ${displayName}`;

  const response: ToolResponse = {
    success: false,
    status: "error",
    error: isReconnect
      ? `Additional ${displayName} permissions required`
      : `${displayName} connection required`,
    ui: {
      type: "connection_required",
      service: provider,
      message: primaryMessage,
      connectButton: {
        text: buttonText,
        action: `connection://${provider}`,
      },
      alternativeMessage,
      // Only include requiredScopes if they are explicitly provided
      ...(requiredScopes && requiredScopes.length > 0 && { requiredScopes }),
      ...(currentScopes.length > 0 && { currentScopes }),
      ...(toolId && { toolId }),
    },
  };

  console.log("[createConnectionRequest] Created response:", {
    success: response.success,
    status: response.status,
    error: response.error,
    hasUI: !!response.ui,
    uiType: response.ui?.type,
    service: response.ui?.service,
    message: response.ui?.message,
    buttonText: response.ui?.connectButton?.text,
    buttonAction: response.ui?.connectButton?.action,
    hasRequiredScopes: !!response.ui?.requiredScopes,
  });

  return response;
}
