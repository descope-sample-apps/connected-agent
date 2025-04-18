import { getOAuthTokenWithScopeValidation } from "../oauth-utils";
import { Tool, ToolConfig, ToolResponse, toolRegistry } from "./base";
import { getRequiredScopes } from "../openapi-utils";

interface DocumentContent {
  title?: string;
  content?: string;
  template?: {
    type: "free-form" | "deal-summary" | "meeting-notes" | "custom";
    data?: any;
  };
  format?: {
    style?: string;
    structure?: string;
  };
  // Add new fields for interactive flows
  stage?: "initial" | "gathering_info" | "confirming" | "creating";
  context?: {
    topic?: string;
    preferences?: {
      style?: string;
      format?: string;
      sections?: string[];
    };
    userInputs?: Record<string, any>;
  };
  needsInput?: {
    field: string;
    message: string;
    options?: string[];
    currentValue?: any;
  };
}

interface GoogleDoc {
  id: string;
  title: string;
  content: string;
  lastModified: string;
}

const documentsConfig: ToolConfig = {
  id: "documents",
  name: "Google Docs",
  description:
    "Create Google Docs with various types of content, including free-form writing, summaries, and structured documents",
  scopes: [], // Will be populated dynamically
  requiredFields: ["title", "content"],
  optionalFields: ["template"],
  capabilities: [
    "Create new documents with custom content",
    "Generate narrative content and personal experiences",
    "Create structured reports and summaries",
    "Format documents with appropriate styling",
  ],
  parameters: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "Title of the document",
      },
      content: {
        type: "string",
        description:
          "Main content for the document. For personal narratives or experiences, provide detailed descriptions.",
      },
      template: {
        type: "object",
        description:
          "Template configuration. Use 'free-form' for narrative content like personal experiences.",
        properties: {
          type: {
            type: "string",
            enum: ["free-form", "deal-summary", "meeting-notes", "custom"],
            default: "free-form",
          },
        },
      },
    },
    required: ["title"],
  },
};

export async function createDocument(
  token: string,
  content: DocumentContent
): Promise<GoogleDoc> {
  try {
    console.log("Creating document with Google Drive API");
    // First, create an empty document using the Drive API
    const createResponse = await fetch(
      "https://www.googleapis.com/drive/v3/files",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: content.title || "Untitled Document",
          mimeType: "application/vnd.google-apps.document",
        }),
      }
    );

    if (!createResponse.ok) {
      const error = await createResponse.json();
      const errorMessage = error.error?.message || createResponse.statusText;

      // Mark this specifically as a Drive API error
      throw new Error(
        `Google Drive API Error: Failed to create document: ${errorMessage}`
      );
    }

    const doc = await createResponse.json();
    console.log("Document created in Drive with ID:", doc.id);

    console.log("Updating document content with Google Docs API");
    // Then, update the document content using the Docs API
    const updateResponse = await fetch(
      `https://www.googleapis.com/docs/v1/documents/${doc.id}:batchUpdate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requests: [
            {
              insertText: {
                location: {
                  index: 1,
                },
                text: content.content || "",
              },
            },
          ],
        }),
      }
    );

    if (!updateResponse.ok) {
      const error = await updateResponse.json();
      const errorMessage = error.error?.message || updateResponse.statusText;

      // Mark this specifically as a Docs API error
      throw new Error(
        `Google Docs API Error: Failed to update document content: ${errorMessage}`
      );
    }

    return {
      id: doc.id,
      title: doc.name,
      content: content.content || "",
      lastModified: doc.modifiedTime,
    };
  } catch (error) {
    // Re-throw with appropriate context for error identification
    if (error instanceof Error) {
      if (error.message.includes("Drive")) {
        // This adds clarity about which scope is missing
        throw new Error(
          `${error.message} - You may need Google Drive access (https://www.googleapis.com/auth/drive scope)`
        );
      } else if (error.message.includes("Docs")) {
        // This adds clarity about which scope is missing
        throw new Error(
          `${error.message} - You may need Google Docs access (https://www.googleapis.com/auth/drive.file scope)`
        );
      }
    }
    throw error;
  }
}

function formatDealSummary(data: Record<string, any>): string {
  const {
    dealName,
    amount,
    stage,
    probability,
    closeDate,
    account,
    owner,
    description,
    activities,
  } = data;

  let content = `# Deal Summary: ${dealName}\n\n`;

  // Basic Information
  content += `## Basic Information\n`;
  content += `- **Amount:** ${amount}\n`;
  content += `- **Stage:** ${stage}\n`;
  content += `- **Probability:** ${probability}%\n`;
  content += `- **Close Date:** ${closeDate}\n`;
  content += `- **Account:** ${account}\n`;
  content += `- **Owner:** ${owner}\n\n`;

  // Description
  if (description) {
    content += `## Description\n${description}\n\n`;
  }

  // Recent Activities
  if (activities && activities.length > 0) {
    content += `## Recent Activities\n`;
    activities.forEach((activity: any) => {
      content += `- **${activity.type}** (${activity.date})\n`;
      content += `  ${activity.description}\n`;
    });
  }

  return content;
}

function formatMeetingNotes(data: Record<string, any>): string {
  const { meetingTitle, date, attendees, agenda, notes, actionItems } = data;

  let content = `# Meeting Notes: ${meetingTitle}\n\n`;

  // Meeting Details
  content += `## Meeting Details\n`;
  content += `- **Date:** ${date}\n`;
  content += `- **Attendees:** ${attendees.join(", ")}\n\n`;

  // Agenda
  if (agenda && agenda.length > 0) {
    content += `## Agenda\n`;
    agenda.forEach((item: string) => {
      content += `- ${item}\n`;
    });
    content += "\n";
  }

  // Notes
  if (notes) {
    content += `## Notes\n${notes}\n\n`;
  }

  // Action Items
  if (actionItems && actionItems.length > 0) {
    content += `## Action Items\n`;
    actionItems.forEach((item: any) => {
      content += `- [ ] ${item.description} (${item.owner})\n`;
    });
  }

  return content;
}

function checkRequiredInformation(context?: DocumentContent["context"]) {
  if (!context) {
    return {
      field: "topic",
      message: "What would you like to write about?",
      options: ["Technology", "Business", "Culture", "Other"],
    };
  }

  if (!context.preferences?.style) {
    return {
      field: "style",
      message: "What style would you prefer for this document?",
      options: ["Formal", "Casual", "Technical", "Narrative"],
    };
  }

  if (
    !context.preferences?.sections ||
    context.preferences.sections.length === 0
  ) {
    return {
      field: "sections",
      message: `For a document about ${context.topic}, I'd recommend including these sections. Would you like to customize them?`,
      options: suggestSectionsForTopic(context.topic),
    };
  }

  return null;
}

function suggestSectionsForTopic(topic?: string): string[] {
  // Example section suggestions for Silicon Valley
  if (topic?.toLowerCase().includes("silicon valley")) {
    return [
      "Historical Background",
      "Key Companies and Innovations",
      "Cultural Impact",
      "Technology Ecosystem",
      "Future Trends",
    ];
  }

  // Default sections
  return ["Introduction", "Main Discussion", "Analysis", "Conclusion"];
}

class DocumentsTool extends Tool<DocumentContent> {
  config: ToolConfig = documentsConfig;

  validate(data: DocumentContent): ToolResponse | null {
    if (!data.title) {
      return {
        success: false,
        error: "Document title is required",
        needsInput: {
          field: "title",
          message: "What would you like to title this document?",
        },
      };
    }

    // For personal narratives or experiences, ensure we're using free-form template
    if (
      data.title.toLowerCase().includes("living in") ||
      data.title.toLowerCase().includes("experience") ||
      data.title.toLowerCase().includes("life")
    ) {
      data.template = {
        type: "free-form",
      };
    }

    return null;
  }

  async execute(userId: string, data: DocumentContent): Promise<ToolResponse> {
    try {
      // Initial request handling
      if (!data.content && !data.template && data.stage !== "gathering_info") {
        return {
          success: false,
          needsInput: {
            field: "context",
            message:
              "To create your document about " +
              (data.context?.topic || "this topic") +
              ", I need some additional information:",
            options: [
              "What specific aspects would you like to focus on?",
              "Would you prefer a formal or casual writing style?",
              "Are there any specific sections you'd like to include?",
              "What's the intended audience for this document?",
            ],
          },
        };
      }

      // Handle information gathering stage
      if (data.stage === "gathering_info") {
        const missingInfo = checkRequiredInformation(data.context);
        if (missingInfo) {
          return {
            success: false,
            needsInput: missingInfo,
          };
        }
      }

      // Validate input
      const validationError = this.validate(data);
      if (validationError) {
        return validationError;
      }

      // Get required scopes for document operations
      const [driveScopes, docsScopes] = await Promise.all([
        getRequiredScopes("google-drive", "files.create"),
        getRequiredScopes("google-docs", "documents.batchUpdate"),
      ]);

      // Combine scopes from both APIs and ensure we have the critical drive scope
      const scopes = [
        ...new Set([
          ...driveScopes,
          ...docsScopes,
          "https://www.googleapis.com/auth/drive.file",
        ]),
      ];

      // Get OAuth token
      const tokenResponse = await getOAuthTokenWithScopeValidation(
        userId,
        "google-docs",
        {
          appId: "google-docs",
          userId,
          scopes,
        }
      );

      if ("error" in tokenResponse) {
        // Safely extract any available scopes information
        const requiredScopes =
          "requiredScopes" in tokenResponse
            ? tokenResponse.requiredScopes
            : scopes;
        const currentScopes =
          "currentScopes" in tokenResponse
            ? tokenResponse.currentScopes
            : undefined;

        // Check if this is specifically a Google Drive scope issue
        const isDriveScope =
          tokenResponse.error &&
          (tokenResponse.error.includes("drive") ||
            tokenResponse.error.includes("Drive") ||
            (requiredScopes &&
              requiredScopes.some((scope) => scope.includes("drive"))));

        // Use appropriate service name based on the required scopes
        const serviceDisplayName = isDriveScope
          ? "Google Docs & Drive"
          : "Google Docs";

        return {
          success: false,
          error: tokenResponse.error,
          ui: {
            type: "connection_required",
            service: "google-docs",
            message: `${serviceDisplayName} access is required to create documents.`,
            connectButton: {
              text: `Connect ${serviceDisplayName}`,
              action: "connection://google-docs",
            },
            alternativeMessage:
              "This will allow the assistant to create and edit documents on your behalf.",
            requiredScopes: requiredScopes,
          },
        };
      }

      // Process template if specified
      let content = data.content;
      if (data.template) {
        switch (data.template.type) {
          case "deal-summary":
            if (!data.template.data) {
              return {
                success: false,
                error: "Missing template data",
                needsInput: {
                  field: "template.data",
                  message: "Please provide the deal data for the summary",
                },
              };
            }
            content = formatDealSummary(data.template.data);
            break;
          case "meeting-notes":
            if (!data.template.data) {
              return {
                success: false,
                error: "Missing template data",
                needsInput: {
                  field: "template.data",
                  message: "Please provide the meeting data for the notes",
                },
              };
            }
            content = formatMeetingNotes(data.template.data);
            break;
          case "custom":
            if (!data.content) {
              return {
                success: false,
                error: "Missing content",
                needsInput: {
                  field: "content",
                  message: "Please provide the document content",
                },
              };
            }
            break;
        }
      }

      // Create document
      const document = await createDocument(
        tokenResponse.token?.accessToken ?? "",
        {
          ...data,
          content,
        }
      );

      return {
        success: true,
        data: {
          documentId: document.id,
          title: document.title,
          lastModified: document.lastModified,
        },
      };
    } catch (error) {
      console.error("Error in documents tool:", error);

      // Extract error message
      const errorMsg =
        error instanceof Error ? error.message : "Failed to create document";
      console.log("Document creation error:", errorMsg);

      // Check if this is a scope-related issue with Drive
      const isGoogleDriveError =
        errorMsg.includes("drive") ||
        errorMsg.includes("Drive") ||
        errorMsg.includes("https://www.googleapis.com/auth/drive");

      // Check if this is an authentication or permission error
      const isAuthError =
        errorMsg.includes("auth") ||
        errorMsg.includes("permission") ||
        errorMsg.includes("token") ||
        errorMsg.includes("unauthorized") ||
        errorMsg.includes("access") ||
        errorMsg.includes("403") ||
        errorMsg.includes("401") ||
        isGoogleDriveError;

      if (isAuthError) {
        // Get required scopes based on the specific error
        let scopes: string[] = ["https://www.googleapis.com/auth/drive.file"];
        let serviceDisplayName = "Google Docs";

        // If it's specifically a Drive error, make sure we include Drive scopes
        if (isGoogleDriveError) {
          scopes.push("https://www.googleapis.com/auth/drive");
          serviceDisplayName = "Google Docs & Drive";
        }

        return {
          success: false,
          error: errorMsg,
          ui: {
            type: "connection_required",
            service: "google-docs",
            message: `${serviceDisplayName} access is required to create documents.`,
            connectButton: {
              text: `Connect ${serviceDisplayName}`,
              action: "connection://google-docs",
            },
            alternativeMessage:
              "This will allow the assistant to create and edit documents on your behalf.",
            requiredScopes: scopes,
          },
        };
      }

      return {
        success: false,
        error: errorMsg,
      };
    }
  }
}

// Create and register the documents tool
const documentsTool = new DocumentsTool();
toolRegistry.register(documentsTool);

// Export the documents tool for direct use if needed
export { documentsTool };

// Export a wrapper function that matches the expected interface in chat/route.ts
export function createDocumentWrapper({
  session,
  dataStream,
}: {
  session: any;
  dataStream: any;
}) {
  return {
    description: "Create a Google Doc document",
    execute: async ({ title, content }: { title: string; content: string }) => {
      try {
        if (!session?.token?.sub) {
          throw new Error("User not authenticated");
        }

        return await documentsTool.execute(session.token.sub, {
          title,
          content,
        });
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to create document",
        };
      }
    },
  };
}
