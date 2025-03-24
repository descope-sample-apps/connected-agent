import { ToolActionResult } from "./oauth-utils";

// In-memory storage for server-side tool actions
const serverStorage: Record<string, ToolActionResult[]> = {};

export function storeToolAction(userId: string, action: ToolActionResult) {
  if (!serverStorage[userId]) {
    serverStorage[userId] = [];
  }
  serverStorage[userId].push(action);
}

export function getServerToolActions(userId: string): ToolActionResult[] {
  return serverStorage[userId] || [];
}

export function getRecentServerToolActions(
  userId: string,
  limit: number = 5
): ToolActionResult[] {
  const actions = getServerToolActions(userId);
  return actions.slice(-limit);
}
