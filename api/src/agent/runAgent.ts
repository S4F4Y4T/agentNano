import { StateGraph, MessagesAnnotation, END, START, GraphRecursionError } from "@langchain/langgraph";
import type { AIMessageChunk, BaseMessage, MessageContent } from "@langchain/core/messages";
import { AIMessage } from "@langchain/core/messages";
import { buildChatModel, type ModelConfig } from "./modelFactory.js";
import { buildMessages } from "./buildMessages.js";
import { executeToolCall, formatToolCallAnnouncement } from "./executeToolCall.js";
import { tools } from "./tools.js";
import { buildPromptScaffold } from "./promptScaffold.js";
import { logger } from "../utils/logger.js";
import type { ChatHistoryItem } from "./types.js";

export type { ChatHistoryItem } from "./types.js";

// Each agent turn that calls tools costs 2 node invocations (agent + tools).
// Allowing MAX_AGENT_STEPS full tool-calling cycles plus one final no-tool
// answer gives MAX_AGENT_STEPS * 2 + 1 total invocations before the graph
// raises GraphRecursionError.
const MAX_AGENT_STEPS = 8;
const RESPONSE_TIMEOUT_MS = 60_000;

export interface RunAgentParams {
  config: ModelConfig;
  systemPrompt: string;
  history: ChatHistoryItem[];
  onToken: (token: string) => void;
}

export async function runAgent(params: RunAgentParams): Promise<string> {
  const llm = buildChatModel(params.config);
  if (!llm.bindTools) throw new Error("This model does not support tool calling");
  const model = llm.bindTools(tools);

  const systemPrompt = buildPromptScaffold(params.systemPrompt);
  const initialMessages = await buildMessages(systemPrompt, params.history);
  const signal = AbortSignal.timeout(RESPONSE_TIMEOUT_MS);

  // Agent node: streams the model response token-by-token via onToken, then
  // returns the accumulated message for the graph state.
  async function agentNode(
    state: typeof MessagesAnnotation.State
  ): Promise<Partial<typeof MessagesAnnotation.State>> {
    const stream = await model.stream(state.messages, { signal });
    let accumulated: AIMessageChunk | undefined;
    for await (const chunk of stream) {
      accumulated = accumulated ? accumulated.concat(chunk) : chunk;
      const token = contentToText(chunk.content);
      if (token) params.onToken(token);
    }
    if (!accumulated) throw new Error("Model returned an empty response stream");
    return { messages: [accumulated] };
  }

  // Tools node: announces each tool call to the token stream, executes it,
  // and returns the ToolMessages for the graph state.
  async function toolsNode(
    state: typeof MessagesAnnotation.State
  ): Promise<Partial<typeof MessagesAnnotation.State>> {
    const last = state.messages[state.messages.length - 1] as AIMessage;
    const toolMessages: BaseMessage[] = [];
    for (const toolCall of last.tool_calls ?? []) {
      params.onToken(formatToolCallAnnouncement(toolCall));
      toolMessages.push(await executeToolCall(toolCall));
    }
    return { messages: toolMessages };
  }

  function shouldContinue(state: typeof MessagesAnnotation.State): "tools" | typeof END {
    const last = state.messages[state.messages.length - 1] as AIMessage;
    return last.tool_calls && last.tool_calls.length > 0 ? "tools" : END;
  }

  const graph = new StateGraph(MessagesAnnotation)
    .addNode("agent", agentNode)
    .addNode("tools", toolsNode)
    .addEdge(START, "agent")
    .addConditionalEdges("agent", shouldContinue)
    .addEdge("tools", "agent")
    .compile();

  try {
    const finalState = await graph.invoke(
      { messages: initialMessages },
      { recursionLimit: MAX_AGENT_STEPS * 2 + 1 }
    );
    const lastMessage = finalState.messages[finalState.messages.length - 1];
    return contentToText(lastMessage.content);
  } catch (err) {
    if (err instanceof GraphRecursionError) {
      logger.warn({ steps: MAX_AGENT_STEPS }, "agent hit max steps without a final answer");
      return "I made several tool calls but couldn't reach a final answer in time. Try rephrasing your request.";
    }
    throw err;
  }
}

function contentToText(content: MessageContent): string {
  return typeof content === "string" ? content : JSON.stringify(content);
}
