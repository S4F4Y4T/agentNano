import { AIMessage, HumanMessage, SystemMessage, ToolMessage, type BaseMessage } from "@langchain/core/messages";
import { readFile } from "node:fs/promises";
import { buildChatModel, type ModelConfig } from "./modelFactory.js";
import { tools } from "./tools.js";

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
  const baseModel = buildChatModel(config);
  if (typeof (baseModel as any).bindTools !== "function") {
    throw new Error("This model does not support tool calling");
  }
  const model = (baseModel as any).bindTools(tools);

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
    let fullResponse = "";
    while (true) {
      const response = await model.invoke(messages, { signal: controller.signal });

      if (response.tool_calls && response.tool_calls.length > 0) {
        messages.push(response);

        for (const toolCall of response.tool_calls) {
          const toolInstance = tools.find((t) => t.name === toolCall.name);
          if (toolInstance) {
            onToken(`\n*[Calling tool: ${toolCall.name} with args: ${JSON.stringify(toolCall.args)}...]*\n`);

            const toolResult = await (toolInstance as any).invoke(toolCall.args);

            messages.push(
              new ToolMessage({
                content: typeof toolResult === "string" ? toolResult : JSON.stringify(toolResult),
                tool_call_id: toolCall.id || "",
              })
            );
          }
        }
      } else {
        const stream = await model.stream(messages, { signal: controller.signal });
        for await (const chunk of stream) {
          const token = typeof chunk.content === "string" ? chunk.content : JSON.stringify(chunk.content);
          if (!token) continue;
          fullResponse += token;
          onToken(token);
        }
        break;
      }
    }
    return fullResponse;
  } finally {
    clearTimeout(timeout);
  }
}
