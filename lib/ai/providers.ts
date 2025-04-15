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

// Feel free to add more models to this list if you clone this repo
export const availableModels: Record<string, ModelConfig> = {
  "gpt-3.5-turbo": {
    name: "GPT-3.5 Turbo",
    provider: "OpenAI",
    maxTokens: 4096,
    supportsFunctions: true,
    supportsVision: false,
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
