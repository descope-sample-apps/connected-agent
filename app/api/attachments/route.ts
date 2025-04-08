import { NextRequest } from "next/server";
import { session } from "@descope/nextjs-sdk/server";

// In a production app, you would use a real file storage service
// like Vercel Blob or S3. For now, we'll just simulate storage
const simulatedFileStorage: Record<string, any> = {};

async function simulateFileUpload(file: File) {
  const id = Math.random().toString(36).substring(2, 15);
  const url = `https://example.com/files/${id}/${file.name}`;

  // In a real implementation, this would upload to a storage service
  simulatedFileStorage[id] = {
    name: file.name,
    type: file.type,
    size: file.size,
    url,
    uploadedAt: new Date().toISOString(),
  };

  return {
    url,
    id,
    filename: file.name,
    fileType: file.type,
    fileSize: file.size,
  };
}

export async function POST(request: NextRequest) {
  const userSession = await session();

  if (!userSession?.token?.sub) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }

    // Check file size (limit to 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return Response.json(
        { error: "File too large (max 10MB)" },
        { status: 400 }
      );
    }

    // Check file type - allow only safe file types
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf",
      "text/plain",
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (!allowedTypes.includes(file.type)) {
      return Response.json({ error: "File type not allowed" }, { status: 400 });
    }

    // Upload the file (simulated)
    const attachment = await simulateFileUpload(file);

    return Response.json({
      success: true,
      attachment,
    });
  } catch (error) {
    console.error("Error handling attachment upload:", error);
    return Response.json(
      { error: "Failed to upload attachment" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const userSession = await session();

  if (!userSession?.token?.sub) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const fileId = searchParams.get("id");

  if (!fileId || !simulatedFileStorage[fileId]) {
    return Response.json({ error: "File not found" }, { status: 404 });
  }

  return Response.json({
    success: true,
    file: simulatedFileStorage[fileId],
  });
}
