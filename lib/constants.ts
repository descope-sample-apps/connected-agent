// Environment detection
export const isProductionEnvironment = process.env.NODE_ENV === "production";
export const isDevelopmentEnvironment = process.env.NODE_ENV === "development";
export const isTestEnvironment = process.env.NODE_ENV === "test";

// API URLs
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

// Application settings
export const SITE_NAME = "CRM Assistant";
export const SITE_DESCRIPTION =
  "Your AI assistant for CRM and scheduling tasks";

// Pagination
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// Authentication
export const AUTH_COOKIE_NAME = "auth_session";

// OAuth providers
export const OAUTH_PROVIDERS = {
  "google-calendar": {
    name: "Google Calendar",
    icon: "/logos/google-calendar.png",
    scopes: ["https://www.googleapis.com/auth/calendar"],
  },
  "google-docs": {
    name: "Google Docs",
    icon: "/logos/google-docs.png",
    scopes: ["https://www.googleapis.com/auth/documents"],
  },
  zoom: {
    name: "Zoom",
    icon: "/logos/zoom-logo.png",
    scopes: ["meeting:write", "meeting:read"],
  },
  "custom-crm": {
    name: "CRM",
    icon: "/logos/crm-logo.png",
    scopes: ["openid", "contacts:read", "deals:read"],
  },
};
