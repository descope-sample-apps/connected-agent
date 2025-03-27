import { session } from "@descope/nextjs-sdk/server";
import {
  getGoogleCalendarToken,
  getGoogleDocsToken,
  getZoomToken,
  getCRMToken,
} from "@/lib/descope";
import { trackOAuthEvent, trackError } from "@/lib/analytics";

export const runtime = "nodejs";

export async function GET() {
  try {
    const userSession = await session();
    const userId = userSession?.token?.sub;

    if (!userId) {
      trackOAuthEvent("auth_error", { error: "missing_user_id" });
      return Response.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Check all connections in parallel
    const [calendarToken, docsToken, zoomToken, crmToken] = await Promise.all([
      getGoogleCalendarToken(userId).catch((error) => {
        trackError(error, { provider: "google-calendar", userId });
        return null;
      }),
      getGoogleDocsToken(userId).catch((error) => {
        trackError(error, { provider: "google-docs", userId });
        return null;
      }),
      getZoomToken(userId).catch((error) => {
        trackError(error, { provider: "zoom", userId });
        return null;
      }),
      getCRMToken(userId).catch((error) => {
        trackError(error, { provider: "custom-crm", userId });
        return null;
      }),
    ]);

    // Track connection statuses
    trackOAuthEvent("connection_check", {
      userId,
      connections: {
        "google-calendar": !!calendarToken && !("error" in calendarToken),
        "google-docs": !!docsToken && !("error" in docsToken),
        zoom: !!zoomToken && !("error" in zoomToken),
        "custom-crm": !!crmToken && !("error" in crmToken),
      },
    });

    // Return the full token data for each provider
    return Response.json({
      connections: {
        "google-calendar":
          calendarToken && !("error" in calendarToken) ? calendarToken : null,
        "google-docs": docsToken && !("error" in docsToken) ? docsToken : null,
        zoom: zoomToken && !("error" in zoomToken) ? zoomToken : null,
        "custom-crm": crmToken && !("error" in crmToken) ? crmToken : null,
      },
    });
  } catch (error) {
    trackError(error as Error, { endpoint: "/api/oauth/connections" });
    console.error("Error checking connections:", error);
    return Response.json(
      { error: "Failed to check connections" },
      { status: 500 }
    );
  }
}
