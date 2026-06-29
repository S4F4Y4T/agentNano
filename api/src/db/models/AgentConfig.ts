import { Schema, model, Types } from "mongoose";

export const PROVIDER_TYPES = ["openai", "gemini", "openrouter", "opencode", "custom"] as const;
export type ProviderType = (typeof PROVIDER_TYPES)[number];

const agentConfigSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    providerType: { type: String, enum: PROVIDER_TYPES, required: true },
    baseUrl: { type: String, required: true },
    apiKeyEncrypted: { type: String, required: true },
    apiKeyMasked: { type: String, required: true },
    model: { type: String, required: true },
    systemPrompt: { type: String, required: true },
    status: { type: String, enum: ["connected", "untested", "error"], default: "untested" },
  },
  { timestamps: true }
);

export interface AgentConfigDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  providerType: ProviderType;
  baseUrl: string;
  apiKeyEncrypted: string;
  apiKeyMasked: string;
  model: string;
  systemPrompt: string;
  status: "connected" | "untested" | "error";
  createdAt: Date;
  updatedAt: Date;
}

export const AgentConfig = model("AgentConfig", agentConfigSchema);
