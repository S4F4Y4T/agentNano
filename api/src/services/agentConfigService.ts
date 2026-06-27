import { HumanMessage } from "@langchain/core/messages";
import { AgentConfig, type ProviderType } from "../db/models/AgentConfig.js";
import { encryptSecret, decryptSecret, maskApiKey } from "../utils/crypto.js";
import { buildChatModel } from "../chat/modelFactory.js";
import { HttpError } from "../utils/httpError.js";

export interface PublicAgentConfig {
  providerType: string;
  baseUrl: string;
  apiKeyMasked: string;
  model: string;
  systemPrompt: string;
  status: string;
  updatedAt: string;
}

function toPublic(doc: {
  providerType: string;
  baseUrl: string;
  apiKeyMasked: string;
  model: string;
  systemPrompt: string;
  status: string;
  updatedAt: Date;
}): PublicAgentConfig {
  return {
    providerType: doc.providerType,
    baseUrl: doc.baseUrl,
    apiKeyMasked: doc.apiKeyMasked,
    model: doc.model,
    systemPrompt: doc.systemPrompt,
    status: doc.status,
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function getAgentConfig(userId: string): Promise<PublicAgentConfig | null> {
  const config = await AgentConfig.findOne({ userId });
  return config ? toPublic(config) : null;
}

export async function saveAgentConfig(
  userId: string,
  input: {
    providerType: ProviderType;
    baseUrl: string;
    apiKey?: string;
    model: string;
    systemPrompt: string;
  }
): Promise<PublicAgentConfig> {
  const existing = await AgentConfig.findOne({ userId });
  if (!existing && !input.apiKey) {
    throw new HttpError(400, "API key is required");
  }

  const update = {
    providerType: input.providerType,
    baseUrl: input.baseUrl,
    model: input.model,
    systemPrompt: input.systemPrompt,
    status: "untested" as const,
    ...(input.apiKey
      ? { apiKeyEncrypted: encryptSecret(input.apiKey), apiKeyMasked: maskApiKey(input.apiKey) }
      : {}),
  };

  const saved = await AgentConfig.findOneAndUpdate(
    { userId },
    { $set: update },
    { upsert: true, new: true }
  );

  return toPublic(saved);
}

export async function testAgentConnection(userId: string): Promise<boolean> {
  const config = await AgentConfig.findOne({ userId });
  if (!config) {
    throw new HttpError(404, "No agent configured yet");
  }

  try {
    const apiKey = decryptSecret(config.apiKeyEncrypted);
    const chatModel = buildChatModel({
      providerType: config.providerType,
      baseUrl: config.baseUrl,
      apiKey,
      model: config.model,
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      await chatModel.invoke([new HumanMessage("Reply with the single word: ok")], {
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    config.status = "connected";
    await config.save();
    return true;
  } catch {
    config.status = "error";
    await config.save();
    return false;
  }
}
