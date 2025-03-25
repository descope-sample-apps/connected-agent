export interface ToolResponse {
  success: boolean;
  data?: any;
  error?: string;
  needsInput?: {
    field: string;
    message: string;
    currentValue?: string;
  };
}

export interface ToolConfig {
  id: string;
  name: string;
  description: string;
  scopes: string[];
  requiredFields: string[];
  optionalFields: string[];
}

export interface Tool {
  config: ToolConfig;
  validate: (data: any) => ToolResponse | null;
  execute: (userId: string, data: any) => Promise<ToolResponse>;
}

class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  register(tool: Tool) {
    this.tools.set(tool.config.id, tool);
  }

  getTool(id: string): Tool | undefined {
    return this.tools.get(id);
  }

  getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  getToolConfigs(): ToolConfig[] {
    return this.getAllTools().map((tool) => tool.config);
  }
}

export const toolRegistry = new ToolRegistry();
