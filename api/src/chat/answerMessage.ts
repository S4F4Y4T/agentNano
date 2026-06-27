import { AIMessage, HumanMessage, SystemMessage, type BaseMessage } from "@langchain/core/messages";
import { readFile } from "node:fs/promises";
import { buildChatModel, type ModelConfig } from "./modelFactory.js";

export interface ChatHistoryItem {
  role: "user" | "assistant";
  content: string;
  attachments?: {
    filename: string;
    mimeType: string;
    filePath: string;
  }[];
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
    if (item.role === "user" && item.attachments && item.attachments.length > 0) {
      const contentBlocks: any[] = [];
      if (item.content) {
        contentBlocks.push({ type: "text", text: item.content });
      }
      for (const att of item.attachments) {
        try {
          if (att.mimeType.startsWith("image/")) {
            const data = await readFile(att.filePath);
            const base64 = data.toString("base64");
            contentBlocks.push({
              type: "image_url",
              image_url: {
                url: `data:${att.mimeType};base64,${base64}`,
              },
            });
          } else if (
            att.mimeType.startsWith("text/") ||
            att.mimeType === "application/json" ||
            att.filename.endsWith(".ts") ||
            att.filename.endsWith(".tsx") ||
            att.filename.endsWith(".js") ||
            att.filename.endsWith(".jsx")
          ) {
            const textContent = await readFile(att.filePath, "utf8");
            contentBlocks.push({
              type: "text",
              text: `\n\n--- Attachment: ${att.filename} ---\n${textContent}\n---------------------------\n`,
            });
          }
        } catch (err) {
          console.error(`Failed to read attachment ${att.filename}:`, err);
        }
      }
      messages.push(new HumanMessage({ content: contentBlocks }));
    } else {
      messages.push(item.role === "user" ? new HumanMessage(item.content) : new AIMessage(item.content));
    }
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
