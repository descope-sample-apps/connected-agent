import { NextResponse } from "next/server";
import { session } from "@descope/nextjs-sdk/server";
import { summarizeDealToDocument } from "@/lib/workflows";
import { apiLogger } from "@/lib/logger";

export async function POST(request: Request) {
  const startTime = Date.now();

  try {
    // Validate authentication
    const userSession = await session();
    const userId = userSession?.token?.sub;

    if (!userId) {
      apiLogger.warn("Unauthorized attempt to access deal summary API");
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Parse request body
    const requestData = await request.json();
    const { dealId } = requestData;

    if (!dealId) {
      apiLogger.warn("Missing dealId in request", { userId });
      return NextResponse.json(
        { error: "Missing required parameter: dealId" },
        { status: 400 }
      );
    }

    apiLogger.info("Processing deal summary request", { userId, dealId });

    // Execute the deal summary workflow
    const result = await summarizeDealToDocument(userId, dealId);

    apiLogger.info("Deal summary workflow completed", {
      userId,
      dealId,
      success: result.success,
      executionTimeMs: result.executionTimeMs,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error || "Failed to generate deal summary",
          details: {
            steps: result.steps.map((step) => ({
              name: step.name,
              success: step.success,
              error: step.error,
            })),
          },
        },
        { status: 500 }
      );
    }

    // Return success response with document info
    const executionTime = Date.now() - startTime;
    apiLogger.info("Deal summary API call completed", {
      userId,
      executionTimeMs: executionTime,
    });

    return NextResponse.json({
      success: true,
      document: {
        id: result.data?.documentId,
        url: result.data?.documentUrl,
        title: result.data?.title,
      },
      executionTimeMs: executionTime,
      steps: result.steps.map((step) => ({
        name: step.name,
        success: step.success,
        executionTimeMs: step.executionTimeMs,
      })),
    });
  } catch (error) {
    const executionTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    apiLogger.error("Error in deal summary API", {
      error: errorMessage,
      executionTimeMs: executionTime,
    });

    return NextResponse.json(
      { error: "Failed to generate deal summary", details: errorMessage },
      { status: 500 }
    );
  }
}
