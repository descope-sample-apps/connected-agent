import { session } from "@descope/nextjs-sdk/server";
import { getChatById, getChatMessages } from "@/lib/db/queries";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  const userSession = await session();

  if (!userSession?.token?.sub) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    // Verify chat ownership
    const chat = await getChatById({ id });

    if (!chat) {
      return new Response("Chat not found", { status: 404 });
    }

    if (chat.userId !== userSession.token.sub) {
      return new Response("Unauthorized", { status: 403 });
    }

    // Get all messages
    const messages = await getChatMessages({ chatId: id });

    // Format messages for export
    const formattedChat = {
      title: chat.title,
      createdAt: chat.createdAt,
      messages: messages.map((message) => ({
        role: message.role,
        content: message.parts.join("\n"),
        timestamp: message.createdAt,
      })),
    };

    // For JSON format
    const jsonContent = JSON.stringify(formattedChat, null, 2);

    // For Markdown format
    let markdownContent = `# ${
      chat.title
    }\nExported on ${new Date().toLocaleString()}\n\n`;

    for (const message of messages) {
      const role = message.role === "user" ? "You" : "Assistant";
      const content = message.parts.join("\n");
      markdownContent += `## ${role} (${new Date(
        message.createdAt
      ).toLocaleString()})\n\n${content}\n\n`;

      // Add attachments if present
      if (message.attachments && message.attachments.length > 0) {
        markdownContent += "### Attachments\n\n";
        for (const attachment of message.attachments) {
          markdownContent += `- [${attachment.filename || "File"}](${
            attachment.url
          })\n`;
        }
        markdownContent += "\n";
      }
    }

    // Determine format from request
    const url = new URL(request.url);
    const format = url.searchParams.get("format") || "json";

    if (format === "markdown") {
      return new Response(markdownContent, {
        headers: {
          "Content-Type": "text/markdown",
          "Content-Disposition": `attachment; filename="${chat.title}.md"`,
        },
      });
    } else {
      return new Response(jsonContent, {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="${chat.title}.json"`,
        },
      });
    }
  } catch (error) {
    console.error("Error exporting chat:", error);
    return new Response("Failed to export chat", { status: 500 });
  }
}
