import {
  Tool,
  ToolConfig,
  ToolResponse,
  toolRegistry,
  createConnectionRequest,
} from "./base";
import { getOAuthTokenWithScopeValidation } from "../oauth-utils";
import { getRequiredScopes } from "@/lib/openapi-utils";

export interface LinkedInPost {
  text: string;
  visibility?: "public" | "connections" | "group";
  imageUrl?: string;
  documentUrl?: string;
}

export interface LinkedInMediaUpload {
  mediaType: "image" | "document";
  title: string;
  description?: string;
  filePath?: string;
  fileUrl?: string;
}

type LinkedInAction =
  | { action: "create_post"; data: LinkedInPost }
  | { action: "upload_media"; data: LinkedInMediaUpload }
  | { action: "update_post"; postId: string; data: Partial<LinkedInPost> };

export class LinkedInTool extends Tool<LinkedInAction> {
  config: ToolConfig = {
    id: "linkedin",
    name: "LinkedIn",
    description:
      "Create and manage posts, upload media, and interact with content on LinkedIn",
    scopes: ["w_member_social"],
    requiredFields: ["action"],
    optionalFields: ["data", "postId"],
    capabilities: [
      "Create LinkedIn posts",
      "Upload images to LinkedIn",
      "Share documents on LinkedIn",
      "Manage post content and visibility",
    ],
    oauthConfig: {
      provider: "linkedin",
      defaultScopes: ["w_member_social"],
      requiredScopes: ["w_member_social"],
      scopeMapping: {
        create_post: ["w_member_social"],
        upload_media: ["w_member_social"],
        update_post: ["w_member_social"],
      },
    },
  };

  validate(data: LinkedInAction): ToolResponse | null {
    if (data.action === "create_post") {
      if (!data.data.text) {
        return {
          success: false,
          error: "Missing post content",
          needsInput: {
            field: "text",
            message: "Please provide the content for your LinkedIn post",
          },
        };
      }
    } else if (data.action === "upload_media") {
      if (!data.data.mediaType) {
        return {
          success: false,
          error: "Missing media type",
          needsInput: {
            field: "mediaType",
            message:
              "Please specify whether you're uploading an image or document",
          },
        };
      }
      if (!data.data.title) {
        return {
          success: false,
          error: "Missing media title",
          needsInput: {
            field: "title",
            message: "Please provide a title for your media upload",
          },
        };
      }
      if (!data.data.fileUrl && !data.data.filePath) {
        return {
          success: false,
          error: "Missing file source",
          needsInput: {
            field: "fileSource",
            message: "Please provide either a file URL or file path",
          },
        };
      }
    } else if (data.action === "update_post") {
      if (!data.postId) {
        return {
          success: false,
          error: "Missing post ID",
          needsInput: {
            field: "postId",
            message: "Please provide the ID of the post to update",
          },
        };
      }
      if (Object.keys(data.data).length === 0) {
        return {
          success: false,
          error: "Missing update data",
          needsInput: {
            field: "data",
            message: "Please provide the content to update in the post",
          },
        };
      }
    }

    return null;
  }

  // Add this method to get required scopes for specific operations
  getToolScopesForOperation(action: string): string[] {
    const scopeMapping = {
      create_post: ["w_member_social"],
      upload_media: ["w_member_social"],
      update_post: ["w_member_social"],
    };

    return (
      scopeMapping[action as keyof typeof scopeMapping] ||
      this.config.scopes ||
      []
    );
  }

  async execute(
    userId: string,
    data: LinkedInAction,
    sessionId?: string
  ): Promise<ToolResponse> {
    try {
      console.log(`[LinkedInTool] Executing ${data.action}:`, data);

      // Get the required scopes for the action
      const requiredScopes = this.getToolScopesForOperation(data.action);

      // Get the OAuth token with scope validation
      const tokenResponse = await getOAuthTokenWithScopeValidation(
        userId,
        "linkedin",
        {
          appId: "linkedin",
          userId,
          scopes: requiredScopes,
          operation: "tool_calling",
        }
      );

      if (!tokenResponse || "error" in tokenResponse) {
        // Extract scope information if available
        const currentScopes =
          "currentScopes" in tokenResponse
            ? tokenResponse.currentScopes
            : undefined;

        return createConnectionRequest({
          provider: "linkedin",
          isReconnect: currentScopes && currentScopes.length > 0,
          requiredScopes,
          currentScopes,
          customMessage: `Please connect your LinkedIn account to perform the ${data.action} action.`,
        });
      }

      // Extract the access token
      const accessToken = tokenResponse.token?.accessToken;

      switch (data.action) {
        case "create_post":
          return await this.createPost(accessToken!, data.data);

        case "upload_media":
          return await this.uploadMedia(accessToken!, data.data);

        case "update_post":
          return await this.updatePost(accessToken!, data.postId, data.data);

        default:
          return {
            success: false,
            error: "Unknown action type",
            status: "error",
          };
      }
    } catch (error: any) {
      if (
        error.message?.includes("OAuth token not found") ||
        error.message?.includes("missing required scopes")
      ) {
        const requiredScopes = this.getToolScopesForOperation(data.action);
        return createConnectionRequest({
          provider: "linkedin",
          isReconnect: false,
          requiredScopes,
          customMessage: `Please connect your LinkedIn account to perform the ${data.action} action.`,
        });
      }
      console.error("LinkedIn Tool Error:", error);
      return {
        success: false,
        error: `Failed to execute LinkedIn action: ${
          error.message || "Unknown error"
        }`,
        status: "error",
      };
    }
  }

  // LinkedIn API methods
  private async createPost(
    accessToken: string,
    postData: LinkedInPost
  ): Promise<ToolResponse> {
    // In a real implementation, this would call the LinkedIn API
    console.log("[LinkedInTool] Creating post:", postData);

    // Simulate successful post creation
    return {
      success: true,
      data: {
        postId: `post-${Date.now()}`,
        published: true,
        visibility: postData.visibility || "connections",
        timestamp: new Date().toISOString(),
        url: `https://www.linkedin.com/feed/update/activity-${Date.now()}`,
        text: "LinkedIn post created successfully",
      },
    };
  }

  private async uploadMedia(
    accessToken: string,
    mediaData: LinkedInMediaUpload
  ): Promise<ToolResponse> {
    // In a real implementation, this would call the LinkedIn API
    console.log("[LinkedInTool] Uploading media:", mediaData);

    // Simulate successful media upload
    return {
      success: true,
      data: {
        mediaId: `media-${Date.now()}`,
        mediaType: mediaData.mediaType,
        title: mediaData.title,
        description: mediaData.description || "",
        url: `https://www.linkedin.com/media/${
          mediaData.mediaType
        }-${Date.now()}`,
        text: `LinkedIn ${mediaData.mediaType} uploaded successfully`,
      },
    };
  }

  private async updatePost(
    accessToken: string,
    postId: string,
    updateData: Partial<LinkedInPost>
  ): Promise<ToolResponse> {
    // In a real implementation, this would call the LinkedIn API
    console.log("[LinkedInTool] Updating post:", { postId, updateData });

    // Simulate successful post update
    return {
      success: true,
      data: {
        postId: postId,
        updated: true,
        timestamp: new Date().toISOString(),
        url: `https://www.linkedin.com/feed/update/${postId}`,
        text: "LinkedIn post updated successfully",
      },
    };
  }
}

// Register the LinkedIn tool
toolRegistry.register(new LinkedInTool());
