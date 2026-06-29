import { AIMessage, HumanMessage, SystemMessage, type BaseMessage } from "@langchain/core/messages";
import { readFile } from "node:fs/promises";
import { logger } from "../utils/logger.js";
import type { ChatHistoryItem } from "./types.js";

/** Converts persisted chat history into the LangChain message list the model sees. */
export async function buildMessages(
  systemPrompt: string,
  history: ChatHistoryItem[]
): Promise<BaseMessage[]> {
  const messages: BaseMessage[] = [new SystemMessage(systemPrompt)];
  for (const item of history) {
    messages.push(await toLangChainMessage(item));
  }
  return messages;
}

async function toLangChainMessage(item: ChatHistoryItem): Promise<BaseMessage> {
  if (item.role === "system") {
    return new SystemMessage(item.content);
  }

  if (item.role === "user" && item.attachments && item.attachments.length > 0) {
    return new HumanMessage({ content: await buildAttachmentContentBlocks(item) });
  }

  return item.role === "user" ? new HumanMessage(item.content) : new AIMessage(item.content);
}

/** Reads each attachment off disk and turns it into a multimodal content block. */
async function buildAttachmentContentBlocks(item: ChatHistoryItem): Promise<any[]> {
  const contentBlocks: any[] = [];
  if (item.content) {
    contentBlocks.push({ type: "text", text: item.content });
  }

  for (const att of item.attachments ?? []) {
    try {
      if (att.mimeType.startsWith("image/")) {
        const data = await readFile(att.filePath);
        const base64 = data.toString("base64");
        contentBlocks.push({
          type: "image_url",
          image_url: { url: `data:${att.mimeType};base64,${base64}` },
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
      logger.error({ err, filename: att.filename }, "failed to read attachment");
    }
  }

  return contentBlocks;
}
