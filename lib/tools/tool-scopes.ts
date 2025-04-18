export interface ToolScope {
  toolId: string;
  scopes: string[];
  description: string;
}

export const TOOL_SCOPES: Record<string, ToolScope> = {
  "google-calendar": {
    toolId: "google-calendar",
    scopes: [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/calendar.events",
    ],
    description: "Access to create and manage calendar events",
  },
  "google-meet": {
    toolId: "google-meet",
    scopes: [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/calendar.events",
    ],
    description: "Access to create Google Meet links",
  },
  "google-docs": {
    toolId: "google-docs",
    scopes: ["https://www.googleapis.com/auth/drive.file"],
    description: "Access to create and manage Google Docs",
  },
  crm: {
    toolId: "custom-crm",
    scopes: ["crm:read", "crm:write"],
    description: "Access to CRM data and operations",
  },
};

export function getRequiredScopes(toolIds: string[]): string[] {
  const scopes = new Set<string>();

  toolIds.forEach((toolId) => {
    const toolScope = TOOL_SCOPES[toolId];
    if (toolScope) {
      toolScope.scopes.forEach((scope) => scopes.add(scope));
    }
  });

  return Array.from(scopes);
}
