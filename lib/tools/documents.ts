import { getOAuthTokenWithScopeValidation } from "../oauth-utils";
import { Tool, ToolConfig, ToolResponse, toolRegistry } from "./base";

interface DocumentContent {
  title: string;
  content: string;
  template?: {
    type: "deal-summary" | "meeting-notes" | "custom";
    data?: Record<string, any>;
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
    "Create and update Google Docs documents, with support for templates and CRM data summaries",
  scopes: [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/drive",
  ],
  requiredFields: ["title", "content"],
  optionalFields: ["template"],
};

async function createDocument(
  token: string,
  content: DocumentContent
): Promise<GoogleDoc> {
  // First, create an empty document
  const createResponse = await fetch(
    "https://www.googleapis.com/drive/v3/files",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: content.title,
        mimeType: "application/vnd.google-apps.document",
      }),
    }
  );

  if (!createResponse.ok) {
    const error = await createResponse.json();
    throw new Error(
      `Failed to create document: ${
        error.error?.message || createResponse.statusText
      }`
    );
  }

  const doc = await createResponse.json();

  // Then, update the document content
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
              text: content.content,
            },
          },
        ],
      }),
    }
  );

  if (!updateResponse.ok) {
    const error = await updateResponse.json();
    throw new Error(
      `Failed to update document content: ${
        error.error?.message || updateResponse.statusText
      }`
    );
  }

  return {
    id: doc.id,
    title: doc.name,
    content: content.content,
    lastModified: doc.modifiedTime,
  };
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

const documentsTool: Tool = {
  config: documentsConfig,

  validate: (data: DocumentContent): ToolResponse | null => {
    if (!data.title) {
      return {
        success: false,
        error: "Missing title",
        needsInput: {
          field: "title",
          message: "Please provide a document title",
        },
      };
    }

    if (!data.content && !data.template) {
      return {
        success: false,
        error: "Missing content",
        needsInput: {
          field: "content",
          message: "Please provide document content or select a template",
        },
      };
    }

    if (data.template && !data.template.type) {
      return {
        success: false,
        error: "Invalid template",
        needsInput: {
          field: "template",
          message: "Please specify a valid template type",
        },
      };
    }

    return null;
  },

  execute: async (
    userId: string,
    data: DocumentContent
  ): Promise<ToolResponse> => {
    try {
      // Validate input
      const validationError = this.validate(data);
      if (validationError) {
        return validationError;
      }

      // Get OAuth token
      const tokenResponse = await getOAuthTokenWithScopeValidation(
        userId,
        "google-docs",
        {
          appId: "google-docs",
          userId,
          scopes: documentsConfig.scopes,
        }
      );

      if ("error" in tokenResponse) {
        return {
          success: false,
          error: tokenResponse.error,
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
      const document = await createDocument(tokenResponse.token.accessToken, {
        ...data,
        content,
      });

      return {
        success: true,
        data: {
          documentId: document.id,
          title: document.title,
          lastModified: document.lastModified,
        },
      };
    } catch (error) {
      console.error("[documentsTool] Error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  },
};

// Register the documents tool
toolRegistry.register(documentsTool);

// Export the documents tool for direct use if needed
export { documentsTool };
