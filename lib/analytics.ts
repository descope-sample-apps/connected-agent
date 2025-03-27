import posthog from "posthog-js";

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
  }
}

// Track OAuth-related events
export function trackOAuthEvent(
  eventName: string,
  properties: Record<string, any>
) {
  posthog.capture(`oauth_${eventName}`, {
    ...properties,
    timestamp: new Date().toISOString(),
  });
}

// Track tool usage
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
  posthog.capture("tool_execution", {
    tool: toolName,
    ...data,
    timestamp: new Date().toISOString(),
  });
}

// Track errors
export function trackError(error: Error, context: Record<string, any>) {
  posthog.capture("error", {
    error_name: error.name,
    error_message: error.message,
    error_stack: error.stack,
    ...context,
    timestamp: new Date().toISOString(),
  });
}
