import { ToolMessage } from "@langchain/core/messages";
import type { ToolCall } from "@langchain/core/messages/tool";
import { tools } from "./tools.js";

/**
 * Runs a single model-requested tool call and always returns a ToolMessage —
 * never throws. Every tool_call the model emits must get exactly one matching
 * ToolMessage back, or the next request to the provider is rejected outright,
 * so an unknown tool name or a thrown error (e.g. a malformed/missing
 * argument, which fails schema validation before the tool's own body runs)
 * is reported back to the model as an error string instead of escaping and
 * killing the whole turn.
 */
export async function executeToolCall(toolCall: ToolCall): Promise<ToolMessage> {
  const result = await runToolSafely(toolCall);
  return new ToolMessage({
    content: typeof result === "string" ? result : JSON.stringify(result),
    tool_call_id: toolCall.id ?? "",
  });
}

async function runToolSafely(toolCall: ToolCall): Promise<unknown> {
  const toolInstance = tools.find((t) => t.name === toolCall.name);
  if (!toolInstance) {
    return `Error: no tool named "${toolCall.name}" is available.`;
  }

  try {
    return await toolInstance.invoke(toolCall.args);
  } catch (err) {
    return `Error: tool call failed - ${err instanceof Error ? err.message : err}`;
  }
}

/** Rendered inline in the token stream so the UI shows the agent's intermediate steps. */
export function formatToolCallAnnouncement(toolCall: ToolCall): string {
  return `\n*[Calling tool: ${toolCall.name} with args: ${JSON.stringify(toolCall.args)}...]*\n`;
}
