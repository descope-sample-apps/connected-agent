import { toolLogger } from "../logger";

export interface ToolResponse {
  success: boolean;
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
}

export abstract class Tool<InputType> {
  abstract config: ToolConfig;

  abstract validate(data: InputType): ToolResponse | null;

  abstract execute(userId: string, data: InputType): Promise<ToolResponse>;

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
