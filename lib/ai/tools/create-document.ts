import { z } from "zod";
import { getGoogleDocsToken } from "@/lib/descope";
import { session } from "@descope/nextjs-sdk/server";

// Descope session has a token.sub property containing the user ID
interface SessionUser {
  token?: {
    sub?: string;
  };
}

// Update the interface to match the one from the AI SDK
interface DataStreamWithAppend {
  append: (data: any) => void;
  close: () => void;
}

// Replace with a more compatible type
interface CreateDocumentProps {
  session: SessionUser | null;
  dataStream: DataStreamWithAppend;
}

export function createDocument({ session, dataStream }: CreateDocumentProps) {
  return {
    description: "Create a new Google Doc document",
    parameters: z.object({
      title: z.string().describe("The title of the document"),
      content: z.string().describe("The content to include in the document"),
    }),
    execute: async ({ title, content }: { title: string; content: string }) => {
      console.log(`Creating document with title: ${title}`);

      try {
        if (!session?.token?.sub) {
          throw new Error("Authentication required to create documents");
        }

        // Update UI with progress
        dataStream.append({
          toolActivity: {
            step: "starting",
            tool: "createDocument",
            title: "Creating Google Doc",
            description: `Creating document titled "${title}"...`,
          },
        });

        // Get token for Google Docs API
        const userId = session.token.sub;
        console.log(`Requesting Google Docs token for user ${userId}`);
        const tokenData = await getGoogleDocsToken(userId);

        console.log("Google Docs token response:", {
          hasToken: !!tokenData,
          hasError: tokenData && "error" in tokenData,
          scopes:
            tokenData && !("error" in tokenData) ? tokenData.token.scopes : [],
          requiredScopes: [
            "https://www.googleapis.com/auth/documents",
            "https://www.googleapis.com/auth/drive",
            "https://www.googleapis.com/auth/drive.file",
          ],
        });

        if (!tokenData || "error" in tokenData) {
          const errorMessage =
            tokenData && "error" in tokenData
              ? `Google Docs connection error: ${tokenData.error}${
                  tokenData.requiredScopes
                    ? `, required scopes: ${tokenData.requiredScopes.join(
                        ", "
                      )}`
                    : ""
                }`
              : "Failed to get Google Docs token";

          console.error(errorMessage);

          dataStream.append({
            toolActivity: {
              step: "error",
              tool: "createDocument",
              title: "Google Docs Connection Required",
              description:
                "Please connect your Google Docs account to create documents.",
            },
          });

          return {
            success: false,
            error: errorMessage,
            needsConnection: true,
            provider: "google-docs",
            requiredScopes:
              tokenData && "requiredScopes" in tokenData
                ? tokenData.requiredScopes
                : [
                    "https://www.googleapis.com/auth/documents",
                    "https://www.googleapis.com/auth/drive",
                    "https://www.googleapis.com/auth/drive.file",
                  ],
            ui: {
              type: "connection_required",
              service: "google-docs",
              message:
                "Please connect your Google Docs account to create documents.",
              requiredScopes:
                tokenData && "requiredScopes" in tokenData
                  ? tokenData.requiredScopes
                  : [
                      "https://www.googleapis.com/auth/documents",
                      "https://www.googleapis.com/auth/drive",
                      "https://www.googleapis.com/auth/drive.file",
                    ],
              connectButton: {
                text: "Connect Google Docs",
                action: "connection://google-docs",
              },
            },
          };
        }

        // Update progress
        dataStream.append({
          toolActivity: {
            step: "processing",
            tool: "createDocument",
            title: "Creating Document",
            description: "Sending request to Google Docs...",
          },
        });

        // Actually create the document using Google Docs API
        // First, create an empty document
        const createResponse = await fetch(
          "https://www.googleapis.com/drive/v3/files",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${tokenData.token.accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: title,
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
        const documentId = doc.id;

        // Update progress
        dataStream.append({
          toolActivity: {
            step: "processing",
            tool: "createDocument",
            title: "Populating Document",
            description: "Adding content to your document...",
          },
        });

        // Then, update the document content
        const updateResponse = await fetch(
          `https://www.googleapis.com/docs/v1/documents/${documentId}:batchUpdate`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${tokenData.token.accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              requests: [
                {
                  insertText: {
                    location: {
                      index: 1,
                    },
                    text: content || "",
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

        // Create a proper Google Docs link
        const documentLink = `https://docs.google.com/document/d/${documentId}/edit`;

        // Final update showing success
        dataStream.append({
          toolActivity: {
            step: "complete",
            tool: "createDocument",
            title: "Document Created",
            description:
              "Your document has been created and populated successfully!",
            fields: {
              Title: title,
              "Document Link": `<a href="${documentLink}" target="_blank">${documentLink}</a>`,
            },
          },
        });

        return {
          success: true,
          documentId,
          title,
          link: documentLink,
          formattedMessage: `I've created a Google Doc titled "${title}" with the content you requested. You can <a href="${documentLink}" target="_blank">access it here</a>.`,
        };
      } catch (error) {
        console.error("Error creating document:", error);

        // Show error in UI
        dataStream.append({
          toolActivity: {
            step: "error",
            tool: "createDocument",
            title: "Error Creating Document",
            description:
              error instanceof Error
                ? error.message
                : "Failed to create document",
          },
        });

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
