import path from "node:path";
import { Message } from "../../db/models/Message.js";
import { Attachment } from "../../db/models/Attachment.js";
import { attachmentsDirFor } from "../../storage/attachments.js";
import {
  isScheduledCommandMessage,
  stripTrailingScheduledCommandMarker,
  wrapAsSystemNotification,
} from "./scheduledCommand.js";
import type { ChatHistoryItem } from "../../agent/types.js";

/** Number of recent messages kept in the agent's context window for a turn. */
export const MAX_HISTORY_MESSAGES = 40;

/**
 * Loads the most recent messages for a conversation directly from the
 * database, bounded at `limit`. Querying with `sort + limit` instead of
 * fetching the whole conversation and slicing in memory keeps the cost of
 * every chat turn flat regardless of how long the conversation has grown.
 */
export async function loadRecentMessages(conversationId: string, limit: number) {
  const recent = await Message.find({ conversationId }).sort({ createdAt: -1 }).limit(limit);
  return recent.reverse();
}

/**
 * Converts a window of persisted messages into the shape the agent
 * consumes: joins in attachments by message id, and rewrites
 * scheduled-command results as system notifications so the model treats
 * them as background events rather than something it said itself.
 */
export async function buildAgentHistory(
  conversationId: string,
  messages: { _id: unknown; role: string; content: string }[]
): Promise<ChatHistoryItem[]> {
  const messageIds = messages.map((m) => m._id);
  const attachments = await Attachment.find({ messageId: { $in: messageIds } });

  const attachmentsByMessageId = new Map<string, (typeof attachments)[number][]>();
  for (const att of attachments) {
    if (!att.messageId) continue;
    const key = String(att.messageId);
    const existing = attachmentsByMessageId.get(key);
    if (existing) existing.push(att);
    else attachmentsByMessageId.set(key, [att]);
  }

  return messages.map((m) => {
    const messageAttachments = attachmentsByMessageId.get(String(m._id)) ?? [];
    const isScheduledCommand = m.role === "assistant" && isScheduledCommandMessage(m.content);
    const content =
      m.role === "assistant" && !isScheduledCommand
        ? stripTrailingScheduledCommandMarker(m.content)
        : m.content;

    return {
      role: isScheduledCommand ? "system" : (m.role as "user" | "assistant"),
      content: isScheduledCommand ? wrapAsSystemNotification(content) : content,
      attachments: messageAttachments.map((att) => ({
        filename: att.filename,
        mimeType: att.mimeType,
        filePath: path.join(attachmentsDirFor(conversationId), att.storageRelativePath),
      })),
    };
  });
}
