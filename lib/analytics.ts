/**
 * Analytics utilities for tracking events and errors
 */

import posthog from "posthog-js";

export type EventType =
  | "connection_initiated"
  | "connection_successful"
  | "connection_failed"
  | "tool_action"
  | "connect_initiated"
  | "disconnect_initiated"
  | "disconnect_successful";

interface SegmentAnalytics {
  load: (writeKey: string, options?: any) => void;
  identify: (userId: string, traits?: any, options?: any) => void;
  track: (event: string, properties?: any, options?: any) => void;
  page: (
    category?: string,
    name?: string,
    properties?: any,
    options?: any
  ) => void;
}

declare global {
  interface Window {
    analytics: SegmentAnalytics;
  }
}

// Initialize PostHog and Segment
export function initAnalytics() {
  if (typeof window !== "undefined") {
    // Initialize PostHog
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      api_host:
        process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com",
      capture_pageview: false, // We'll handle pageviews manually
      persistence: "localStorage",
      autocapture: false,
      disable_session_recording: true, // Enable only if needed
    });

    // Initialize Segment
    const segmentKey = process.env.NEXT_PUBLIC_SEGMENT_KEY;
    if (segmentKey) {
      // Load the Segment analytics.js snippet
      const analytics = (window.analytics = window.analytics || []);
      if (!analytics.initialize) {
        if (analytics.invoked) {
          console.error("Segment snippet included twice");
        } else {
          analytics.invoked = true;
          analytics.methods = [
            "trackSubmit",
            "trackClick",
            "trackLink",
            "trackForm",
            "pageview",
            "identify",
            "reset",
            "group",
            "track",
            "ready",
            "alias",
            "debug",
            "page",
            "once",
            "off",
            "on",
            "addSourceMiddleware",
            "addIntegrationMiddleware",
            "setAnonymousId",
            "addDestinationMiddleware",
          ];
          analytics.factory = function (method: string) {
            return function () {
              const args = Array.prototype.slice.call(arguments);
              args.unshift(method);
              analytics.push(args);
              return analytics;
            };
          };
          for (let i = 0; i < analytics.methods.length; i++) {
            const key = analytics.methods[i];
            analytics[key] = analytics.factory(key);
          }
          analytics.SNIPPET_VERSION = "4.13.2";
          analytics.load(segmentKey);
        }
      }
    }

    console.log("[Analytics] Initialized");
  }
}

// Alias for backward compatibility
export const initPostHog = initAnalytics;

/**
 * Identify a user in analytics platforms
 */
export function identifyUser(userId: string, traits: Record<string, any> = {}) {
  // In development, log to console
  if (process.env.NODE_ENV !== "production") {
    console.log(`[Analytics] Identify User: ${userId}`, traits);
  }

  // Identify in PostHog
  posthog.identify(userId, traits);

  // Identify in Segment if available
  if (typeof window !== "undefined" && window.analytics) {
    window.analytics.identify(userId, traits);
  }
}

/**
 * Track a page view in analytics platforms
 */
export function trackPageView(
  pageName: string,
  properties: Record<string, any> = {}
) {
  // In development, log to console
  if (process.env.NODE_ENV !== "production") {
    console.log(`[Analytics] Page View: ${pageName}`, properties);
  }

  // Track in Segment if available
  if (typeof window !== "undefined" && window.analytics) {
    window.analytics.page(pageName, properties);
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

  // Send to Segment if available
  if (typeof window !== "undefined" && window.analytics) {
    window.analytics.track(`oauth_${event}`, {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }
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

  // Send to Segment if available
  if (typeof window !== "undefined" && window.analytics) {
    window.analytics.track("tool_execution", {
      tool: toolName,
      ...data,
      timestamp: new Date().toISOString(),
    });
  }
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

  // Send to Segment if available
  if (typeof window !== "undefined" && window.analytics) {
    window.analytics.track("error", {
      error_name: error.name,
      error_message: error.message,
      error_stack: error.stack,
      ...context,
      timestamp: new Date().toISOString(),
    });
  }
}
