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
      return Response.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Add debug logging
    console.log("Checking connections for user:", userId);

    // Check all connections in parallel
    const [calendarToken, docsToken, zoomToken, crmToken] = await Promise.all([
      getGoogleCalendarToken(userId).catch((error) => {
        console.error("Calendar token error:", error);
        return null;
      }),
      getGoogleDocsToken(userId).catch((error) => {
        console.error("Docs token error:", error);
        return null;
      }),
      getZoomToken(userId).catch((error) => {
        console.error("Zoom token error:", error);
        return null;
      }),
      getCRMToken(userId).catch((error) => {
        console.error("CRM token error:", error);
        return null;
      }),
    ]);

    // Debug log the tokens
    console.log("Connection check results:", {
      calendar: !!calendarToken,
      docs: !!docsToken,
      zoom: !!zoomToken,
      crm: !!crmToken,
    });

    // Return the full token data for each provider
    return Response.json({
      connections: {
        "google-calendar":
          calendarToken && !("error" in calendarToken)
            ? calendarToken.token
            : null,
        "google-docs":
          docsToken && !("error" in docsToken) ? docsToken.token : null,
        zoom: zoomToken && !("error" in zoomToken) ? zoomToken.token : null,
        crm: crmToken && !("error" in crmToken) ? crmToken.token : null,
      },
    });
  } catch (error) {
    console.error("Error checking connections:", error);

    // Return empty connections object instead of error to prevent UI issues
    return Response.json({
      connections: {
        "google-calendar": null,
        "google-docs": null,
        zoom: null,
        crm: null,
      },
    });
  }
}
