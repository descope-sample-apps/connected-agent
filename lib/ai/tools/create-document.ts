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
  dataStream: { append: (data: any) => void };
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
        const tokenData = await getGoogleDocsToken(userId);

        if (!tokenData || "error" in tokenData) {
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
            error:
              "To create documents, please connect your Google Docs account",
            needsConnection: true,
            provider: "google-docs",
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

        // This is where you'd make the actual API call to Google Docs
        // For this example, we'll simulate it with a delay
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Simulate a document ID and link
        const documentId = `doc-${Math.random().toString(36).substring(2, 10)}`;
        const documentLink = `https://docs.google.com/document/d/${documentId}/edit`;

        // Final update showing success
        dataStream.append({
          toolActivity: {
            step: "complete",
            tool: "createDocument",
            title: "Document Created",
            description: "Your document has been created successfully!",
            fields: {
              Title: title,
              "Document Link": documentLink,
            },
          },
        });

        return {
          success: true,
          documentId,
          title,
          link: documentLink,
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
