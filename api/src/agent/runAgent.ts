import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { AIMessageChunk, BaseMessage, MessageContent } from "@langchain/core/messages";
import { buildChatModel, type ModelConfig } from "./modelFactory.js";
import { buildMessages } from "./buildMessages.js";
import { executeToolCall, formatToolCallAnnouncement } from "./executeToolCall.js";
import { tools } from "./tools.js";
import { logger } from "../utils/logger.js";
import type { ChatHistoryItem } from "./types.js";

export type { ChatHistoryItem } from "./types.js";

// Hard ceiling on tool-call round-trips per turn. Without this, a model that
// keeps calling tools without ever producing a final answer would spin until
// the overall response timeout aborts the request — which the caller can
// only report as a generic "couldn't reach the provider" failure. Stopping
// here instead lets the agent fail with an actual explanation.
const MAX_AGENT_STEPS = 8;
const RESPONSE_TIMEOUT_MS = 60_000;

export interface RunAgentParams {
  config: ModelConfig;
  systemPrompt: string;
  history: ChatHistoryItem[];
  onToken: (token: string) => void;
}

/**
 * Runs one agent turn: builds the message list, lets the model call tools
 * across as many steps as it needs (each step: model decides, tools run,
 * results feed back in), then returns the final text answer.
 *
 * Every step streams rather than invokes-then-streams: a non-streaming
 * `invoke()` followed by a `stream()` of the same messages would cost two
 * full model calls for the (common) case where the model answers without
 * calling a tool. Streaming unconditionally costs exactly one call per step
 * regardless of which case it turns out to be.
 */
export async function runAgent(params: RunAgentParams): Promise<string> {
  const model = bindToolCalling(buildChatModel(params.config));
  const messages = await buildMessages(params.systemPrompt, params.history);
  const signal = AbortSignal.timeout(RESPONSE_TIMEOUT_MS);

  for (let step = 0; step < MAX_AGENT_STEPS; step++) {
    const response = await streamStep(model, messages, signal, params.onToken);

    if (!response.tool_calls || response.tool_calls.length === 0) {
      return contentToText(response.content);
    }

    messages.push(response);
    for (const toolCall of response.tool_calls) {
      params.onToken(formatToolCallAnnouncement(toolCall));
      messages.push(await executeToolCall(toolCall));
    }
  }

  logger.warn({ steps: MAX_AGENT_STEPS }, "agent hit max steps without a final answer");
  return "I made several tool calls but couldn't reach a final answer in time. Try rephrasing your request.";
}

type ToolCallingModel = ReturnType<NonNullable<BaseChatModel["bindTools"]>>;

function bindToolCalling(model: BaseChatModel): ToolCallingModel {
  if (!model.bindTools) {
    throw new Error("This model does not support tool calling");
  }
  return model.bindTools(tools);
}

/**
 * Streams one model turn and accumulates the chunks into a single message.
 * Tool-call arguments arrive as partial JSON fragments across chunks and
 * only resolve into a usable `.tool_calls` array once concatenated, so
 * whether this step ends in a tool call or a final answer isn't known until
 * the stream ends either way — tokens are still forwarded live as they
 * arrive so the UI doesn't wait for the whole response to render anything.
 */
async function streamStep(
  model: ToolCallingModel,
  messages: BaseMessage[],
  signal: AbortSignal,
  onToken: (token: string) => void
): Promise<AIMessageChunk> {
  const stream = await model.stream(messages, { signal });
  let accumulated: AIMessageChunk | undefined;
  for await (const chunk of stream) {
    accumulated = accumulated ? accumulated.concat(chunk) : chunk;
    const token = contentToText(chunk.content);
    if (token) onToken(token);
  }
  if (!accumulated) {
    throw new Error("Model returned an empty response stream");
  }
  return accumulated;
}

function contentToText(content: MessageContent): string {
  return typeof content === "string" ? content : JSON.stringify(content);
}
