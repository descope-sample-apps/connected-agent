import { session } from "@descope/nextjs-sdk/server";
import {
  getGoogleCalendarToken,
  getGoogleDocsToken,
  getZoomToken,
  getCRMToken,
} from "@/lib/descope";

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

    // Check all connections in parallel
    const [calendarToken, docsToken, zoomToken, crmToken] = await Promise.all([
      getGoogleCalendarToken(userId).catch(() => null),
      getGoogleDocsToken(userId).catch(() => null),
      getZoomToken(userId).catch(() => null),
      getCRMToken(userId).catch(() => null),
    ]);

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
    console.error("Error checking connections:", error);
    return Response.json(
      { error: "Failed to check connections" },
      { status: 500 }
    );
  }
}
