export type ProviderType = "openai" | "gemini" | "openrouter" | "opencode" | "custom";

export const PROVIDER_LABELS: Record<ProviderType, string> = {
  openai: "OpenAI",
  gemini: "Google Gemini",
  openrouter: "OpenRouter",
  opencode: "OpenCode",
  custom: "Custom (OpenAI-compatible)",
};

export const PROVIDER_BASE_URLS: Record<ProviderType, string> = {
  openai: "https://api.openai.com/v1",
  gemini: "https://generativelanguage.googleapis.com/v1beta",
  openrouter: "https://openrouter.ai/api/v1",
  opencode: "https://opencode.ai/zen/v1",
  custom: "",
};

export type AgentConfigStatus = "connected" | "untested" | "error";

export interface AgentConfig {
  providerType: ProviderType;
  baseUrl: string;
  apiKeyMasked: string;
  model: string;
  systemPrompt: string;
  status: AgentConfigStatus;
  updatedAt: string;
}

export type MessageRole = "user" | "assistant";

export interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  streaming?: boolean;
  attachments?: Attachment[];
  createdAt: string;
}

export interface Conversation {
  id: string;
  title: string;
  lastMessageAt: string;
  createdAt: string;
}

export interface Session {
  id: string;
  name: string;
  email: string;
}
