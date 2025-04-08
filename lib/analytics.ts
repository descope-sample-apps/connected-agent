/**
 * Analytics utilities for tracking events and errors
 */

import posthog from "posthog-js";

export type EventType =
  | "connection_initiated"
  | "connection_successful"
  | "connection_failed"
  | "tool_action";

// Initialize PostHog
export function initPostHog() {
  if (typeof window !== "undefined") {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      api_host:
        process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com",
      capture_pageview: false, // We'll handle pageviews manually
      persistence: "localStorage",
      autocapture: false,
      disable_session_recording: true, // Enable only if needed
    });
    console.log("[Analytics] Initialized");
  }
}

/**
 * Track an OAuth-related event
 */
export function trackOAuthEvent(
  event: EventType,
  data: Record<string, any> = {}
) {
  // In development, log to console
  if (process.env.NODE_ENV !== "production") {
    console.log(`[Analytics] OAuth Event: ${event}`, data);
  }

  // In production, send to PostHog
  posthog.capture(`oauth_${event}`, {
    ...data,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Track tool usage
 */
export function trackToolUsage(
  toolName: string,
  data: {
    userId: string;
    success: boolean;
    error?: string;
    prompt?: string;
    duration?: number;
  }
) {
  // In development, log to console
  if (process.env.NODE_ENV !== "production") {
    console.log(`[Analytics] Tool Usage: ${toolName}`, data);
  }

  // In production, send to PostHog
  posthog.capture("tool_execution", {
    tool: toolName,
    ...data,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Track an error
 */
export function trackError(error: Error, context: Record<string, any> = {}) {
  // In development, log to console
  if (process.env.NODE_ENV !== "production") {
    console.error(`[Analytics] Error: ${error.message}`, {
      ...context,
      stack: error.stack,
    });
  }

  // In production, send to PostHog
  posthog.capture("error", {
    error_name: error.name,
    error_message: error.message,
    error_stack: error.stack,
    ...context,
    timestamp: new Date().toISOString(),
  });
}
