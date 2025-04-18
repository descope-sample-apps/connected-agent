# Adding Custom Tools to the CRM Assistant

This document explains how to add your own custom tools and integrations to the CRM Assistant. The application uses a flexible architecture that allows for easy extension with new functionalities.

## Architecture Overview

The CRM Assistant is built with:

- Next.js (React) for the frontend
- AI SDK for chat functionality
- Tool-calling pattern for integrating with external services
- Descope for OAuth token management

## Tool Implementation Process

### 1. Create a New Tool Class

Tools are implemented as classes that extend a base `Tool` class. Create a new file in `lib/tools/your-tool-name.ts`:

```typescript
import { Tool, ToolCallInput, ToolCallOutput } from "../base-tool";

export class YourCustomTool extends Tool {
  // Define tool metadata (name, description, parameters)
  config() {
    return {
      name: "your_custom_tool_name",
      description: "Description of what your tool does",
      parameters: {
        type: "object",
        properties: {
          // Define parameters your tool accepts
          param1: {
            type: "string",
            description: "Description of param1",
          },
          // Add more parameters as needed
        },
        required: ["param1"], // List required parameters
      },
    };
  }

  // Validate input parameters
  validate(input: ToolCallInput): boolean {
    // Implement validation logic
    return true;
  }

  // Execute the tool functionality
  async execute(input: ToolCallInput): Promise<ToolCallOutput> {
    try {
      // Implement your tool's core functionality here
      // Example:
      // 1. Process input parameters
      const { param1 } = input.parameters;

      // 2. Perform the action (API call, data processing, etc.)
      const result = await yourApiCall(param1);

      // 3. Return the result
      return {
        content: JSON.stringify(result),
      };
    } catch (error) {
      return {
        error: `Error in custom tool: ${error.message}`,
      };
    }
  }
}

// Helper function for your tool
async function yourApiCall(param: string) {
  // Implement your API call or functionality
  return { success: true, data: `Processed ${param}` };
}
```

### 2. Register Your Tool

Add your tool to the tool registry in `lib/tools/index.ts`:

```typescript
import { ToolRegistry } from "../tool-registry";
import { YourCustomTool } from "./your-tool-name";

// Get existing registry or initialize a new one
export const toolRegistry = getToolRegistry();

// Register your custom tool
toolRegistry.register(new YourCustomTool());
```

### 3. Add Tool Schema to AI Configuration

Update the `APPROVED_TOOLS` array in `lib/ai/models.ts` to include your tool's schema:

```typescript
export const APPROVED_TOOLS = [
  // Existing tools...
  {
    type: "function",
    function: {
      name: "your_custom_tool_name",
      description: "Description of what your tool does",
      parameters: {
        type: "object",
        properties: {
          param1: {
            type: "string",
            description: "Description of param1",
          },
          // Add more parameters as needed
        },
        required: ["param1"],
      },
    },
  },
];
```

### 4. Add UI Elements (Optional)

If you want to showcase your tool in the sidebar or quick actions:

1. Add an icon or logo for your tool in the `public/logos/` directory
2. Update the `actionOptions` array in `app/page.tsx`:

```typescript
const actionOptions = [
  // Existing options...
  {
    id: "your-custom-tool",
    title: "Your Custom Tool",
    description: "Description of your custom tool",
    logo: "/logos/your-custom-tool-logo.png",
    action: () =>
      usePredefinedPrompt("Example prompt for your tool", "your-custom-tool"),
  },
];
```

## OAuth Integration (If Needed)

If your tool requires OAuth authentication with external services:

1. Set up the OAuth app in Descope:

   - Go to the Descope console
   - Create a new OAuth application in the Outbound Apps section
   - Configure the required scopes and redirect URIs

2. Fetch OAuth tokens in your tool:

```typescript
import { getOAuthToken } from "@/lib/oauth";

async function getServiceToken() {
  const token = await getOAuthToken({
    appId: "your-service-id", // e.g., "github", "slack"
    scopes: ["scope1", "scope2"], // Required scopes
  });

  return token;
}
```

3. Handle connection flows:

```typescript
// In your tool's execute method
try {
  const token = await getServiceToken();
  // Use token for API calls
} catch (error) {
  if (error.code === "token_not_found") {
    // Return a response that will prompt the user to connect
    return {
      content:
        "This action requires connecting to [Service]. Please visit the profile settings to connect.",
      metadata: {
        needsConnection: true,
        service: "your-service-id",
      },
    };
  }
  throw error;
}
```

## Testing Your Tool

1. Run the application locally: `npm run dev`
2. Test your tool by:
   - Using the chat interface to trigger your tool
   - Using the quick action button if you added UI elements
   - Checking the console for any errors during execution

## Best Practices

1. **Error Handling**: Implement robust error handling in your tool
2. **Rate Limiting**: Consider service rate limits for external APIs
3. **User Feedback**: Provide clear feedback when a tool is being used
4. **Security**: Never hardcode API keys or secrets, use environment variables
5. **Documentation**: Document your tool's purpose, usage, and parameters

## Example: Custom Weather Tool

```typescript
import { Tool, ToolCallInput, ToolCallOutput } from "../base-tool";

export class WeatherTool extends Tool {
  config() {
    return {
      name: "get_weather",
      description: "Get current weather information for a location",
      parameters: {
        type: "object",
        properties: {
          location: {
            type: "string",
            description: "City name or location",
          },
          units: {
            type: "string",
            enum: ["metric", "imperial"],
            description: "Temperature units (metric or imperial)",
          },
        },
        required: ["location"],
      },
    };
  }

  validate(input: ToolCallInput): boolean {
    return Boolean(input.parameters.location);
  }

  async execute(input: ToolCallInput): Promise<ToolCallOutput> {
    try {
      const { location, units = "metric" } = input.parameters;
      const apiKey = process.env.WEATHER_API_KEY;

      const response = await fetch(
        `https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${location}&units=${units}`
      );

      if (!response.ok) {
        throw new Error(`Weather API error: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        content: JSON.stringify({
          location: data.location.name,
          temperature: data.current.temp_c,
          condition: data.current.condition.text,
          humidity: data.current.humidity,
        }),
      };
    } catch (error) {
      return {
        error: `Error fetching weather: ${error.message}`,
      };
    }
  }
}
```

## Need More Help?

Refer to:

- The `lib/tools/` directory for existing tool implementations
- The `lib/ai/models.ts` file for tool schema definitions
- The Descope documentation for OAuth configuration
