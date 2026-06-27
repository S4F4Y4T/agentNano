import { AIMessage, HumanMessage, SystemMessage, type BaseMessage } from "@langchain/core/messages";
import { buildChatModel, type ModelConfig } from "./modelFactory.js";

export interface ChatHistoryItem {
  role: "user" | "assistant";
  content: string;
}

export async function answerMessage(
  config: ModelConfig,
  systemPrompt: string,
  history: ChatHistoryItem[],
  onToken: (token: string) => void
): Promise<string> {
  const model = buildChatModel(config);

  const messages: BaseMessage[] = [new SystemMessage(systemPrompt)];
  for (const item of history) {
    messages.push(item.role === "user" ? new HumanMessage(item.content) : new AIMessage(item.content));
  }

  console.log("[llm:request]", JSON.stringify({
    providerType: config.providerType,
    model: config.model,
    baseUrl: config.baseUrl,
    systemPrompt,
    history,
  }));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const stream = await model.stream(messages, { signal: controller.signal });
    let full = "";
    for await (const chunk of stream) {
      const token = typeof chunk.content === "string" ? chunk.content : JSON.stringify(chunk.content);
      if (!token) continue;
      full += token;
      onToken(token);
    }
    return full;
  } finally {
    clearTimeout(timeout);
  }
}
