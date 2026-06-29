import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { ProviderType } from "../db/models/AgentConfig.js";

export interface ModelConfig {
  providerType: ProviderType;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export function buildChatModel(config: ModelConfig): BaseChatModel {
  if (config.providerType === "gemini") {
    return new ChatGoogleGenerativeAI({
      apiKey: config.apiKey,
      model: config.model,
      streaming: true,
    });
  }

  return new ChatOpenAI({
    apiKey: config.apiKey,
    model: config.model,
    streaming: true,
    configuration: {
      baseURL: config.baseUrl || undefined,
    },
  });
}
