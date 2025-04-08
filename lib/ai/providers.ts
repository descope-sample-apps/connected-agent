import { openai } from "@ai-sdk/openai";
import type { Provider } from "ai";

interface ModelConfig {
  name: string;
  provider: string;
  maxTokens?: number;
  temperature?: number;
  supportsFunctions?: boolean;
  supportsVision?: boolean;
  paid?: boolean;
}

export const availableModels: Record<string, ModelConfig> = {
  "gpt-3.5-turbo": {
    name: "GPT-3.5 Turbo",
    provider: "OpenAI",
    maxTokens: 4096,
    supportsFunctions: true,
    supportsVision: false,
  },
  "gpt-4-turbo": {
    name: "GPT-4 Turbo",
    provider: "OpenAI",
    maxTokens: 128000,
    supportsFunctions: true,
    supportsVision: true,
    paid: true,
  },
  "gpt-4o": {
    name: "GPT-4o",
    provider: "OpenAI",
    maxTokens: 128000,
    supportsFunctions: true,
    supportsVision: true,
    paid: true,
  },
};

// Define a custom provider that implements the required interface
export const myProvider: Provider = {
  languageModel: (model: string) => {
    // Get the model configuration or default to gpt-3.5-turbo
    const modelName = model in availableModels ? model : "gpt-3.5-turbo";
    return openai(modelName);
  },

  // Add these to satisfy the Provider interface
  textEmbeddingModel: () => {
    throw new Error("Text embedding model not implemented");
  },

  imageModel: () => {
    throw new Error("Image model not implemented");
  },
};
