import type { PublicConversation, PublicMessage } from "./types.js";

export function serializeConversation(c: {
  _id: unknown;
  title: string;
  lastMessageAt: Date;
  createdAt: Date;
}): PublicConversation {
  return {
    id: String(c._id),
    title: c.title,
    lastMessageAt: c.lastMessageAt.toISOString(),
    createdAt: c.createdAt.toISOString(),
  };
}

export function serializeMessage(m: {
  _id: unknown;
  conversationId: unknown;
  role: string;
  content: string;
  attachments?: unknown;
  createdAt: Date;
}): PublicMessage {
  return {
    id: String(m._id),
    conversationId: String(m.conversationId),
    role: m.role,
    content: m.content,
    attachments: m.attachments ?? undefined,
    createdAt: m.createdAt.toISOString(),
  };
}
