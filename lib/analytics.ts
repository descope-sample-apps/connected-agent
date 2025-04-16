/**
 * Analytics utilities for tracking events and errors
 */

export type EventType =
  | "connection_initiated"
  | "connection_successful"
  | "connection_failed"
  | "tool_action"
  | "connect_initiated"
  | "disconnect_initiated"
  | "disconnect_successful"
  | "signin_successful"
  | "signin_failed"
  | "prompt_submitted"
  | "prompt_completed";

// Extended SegmentAnalytics interface that includes the initialization properties
interface SegmentAnalytics {
  // Core methods
  load: (writeKey: string, options?: any) => void;
  identify: (userId: string, traits?: any, options?: any) => void;
  track: (event: string, properties?: any, options?: any) => void;
  page: (
    category?: string,
    name?: string,
    properties?: any,
    options?: any
  ) => void;

  // Initialization properties
  initialize?: boolean;
  invoked?: boolean;
  methods?: string[];
  factory?: (method: string) => (...args: any[]) => any;
  push?: (args: any[]) => any;
  SNIPPET_VERSION?: string;

  // Other methods from analytics.methods array
  [key: string]: any;
}

// Define a custom type for the analytics global
interface AnalyticsWindow extends Window {
  analytics: SegmentAnalytics;
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

    // Initialize Segment
    const segmentKey = process.env.NEXT_PUBLIC_SEGEMENT_WRITE_KEY;
    if (segmentKey) {
      // Log the initialization with the write key (truncated for security)
      console.log(
        `[Analytics] Initializing Segment with key: ${segmentKey.substring(
          0,
          4
        )}...`
      );

      // Load the Segment analytics.js snippet
      const analytics = ((window as unknown as AnalyticsWindow).analytics =
        (window as unknown as AnalyticsWindow).analytics || []);

      // Safely check if analytics.initialize exists
      if (typeof analytics.initialize === "undefined") {
        // Safely check if analytics.invoked exists
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
              // Type assertion for analytics.push
              if (typeof analytics.push === "function") {
                analytics.push(args);
              }
              return analytics;
            };
          };

          // Safely assign methods to analytics object
          if (analytics.methods && Array.isArray(analytics.methods)) {
            for (let i = 0; i < analytics.methods.length; i++) {
              const key = analytics.methods[i];
              // Use type assertion to avoid TypeScript errors
              if (analytics.factory) {
                (analytics as any)[key] = analytics.factory(key);
              }
            }
          }

          analytics.SNIPPET_VERSION = "4.13.2";
          if (typeof analytics.load === "function") {
            analytics.load(segmentKey);
          }
        }
      }
    } else {
      console.warn(
        "[Analytics] Segment write key not found. Segment analytics disabled."
      );
    }

    console.log("[Analytics] Initialized");
  }
}
/**
 * Identify a user in analytics platforms
 */
export function identifyUser(userId: string, traits: Record<string, any> = {}) {
  // In development, log to console
  if (process.env.NODE_ENV !== "production") {
    console.log(`[Analytics] Identify User: ${userId}`, traits);
  }

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
    window.analytics.page(pageName);
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

  // Send to Segment if available
  if (
    typeof window !== "undefined" &&
    window.analytics &&
    typeof window.analytics.track === "function"
  ) {
    // Use type assertion to avoid TypeScript errors
    window.analytics.track(`oauth_${event}` as string, {
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

/**
 * Track a user prompt submission or completion
 */
export function trackPrompt(
  event: "prompt_submitted" | "prompt_completed",
  data: {
    userId?: string;
    promptText?: string;
    chatId?: string;
    modelName?: string;
    success?: boolean;
    responseTime?: number;
  }
) {
  // In development, log to console
  if (process.env.NODE_ENV !== "production") {
    console.log(`[Analytics] Prompt Event: ${event}`, data);
  }

  // Send to Segment if available
  if (typeof window !== "undefined" && window.analytics) {
    window.analytics.track(`prompt_${event}`, {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }
}
