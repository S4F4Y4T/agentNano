import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { rm } from "node:fs/promises";
import { Conversation } from "../db/models/Conversation.js";
import { Message } from "../db/models/Message.js";
import { Attachment } from "../db/models/Attachment.js";
import { authenticate } from "../middleware/authenticate.js";
import { attachmentsDirFor } from "../storage/attachments.js";

const sendMessageSchema = z.object({
  content: z.string().max(20_000),
  attachmentIds: z.array(z.string()).default([]),
});

function serializeConversation(c: { _id: unknown; title: string; lastMessageAt: Date; createdAt: Date }) {
  return {
    id: String(c._id),
    title: c.title,
    lastMessageAt: c.lastMessageAt.toISOString(),
    createdAt: c.createdAt.toISOString(),
  };
}

function serializeMessage(m: {
  _id: unknown;
  conversationId: unknown;
  role: string;
  content: string;
  attachments?: unknown;
  createdAt: Date;
}) {
  return {
    id: String(m._id),
    conversationId: String(m.conversationId),
    role: m.role,
    content: m.content,
    attachments: m.attachments ?? undefined,
    createdAt: m.createdAt.toISOString(),
  };
}

export async function conversationsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  app.get("/api/conversations", async (request, reply) => {
    const { search } = request.query as { search?: string };
    const filter: Record<string, unknown> = { userId: request.userId };
    if (search && search.trim()) {
      filter.title = { $regex: search.trim(), $options: "i" };
    }
    const conversations = await Conversation.find(filter).sort({ lastMessageAt: -1 });
    return reply.send({ conversations: conversations.map(serializeConversation) });
  });

  app.post("/api/conversations", async (request, reply) => {
    const conversation = await Conversation.create({ userId: request.userId, title: "New chat" });
    return reply.code(201).send({ conversation: serializeConversation(conversation) });
  });

  app.patch("/api/conversations/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { title } = z.object({ title: z.string().min(1).max(200) }).parse(request.body);
    const conversation = await Conversation.findOneAndUpdate(
      { _id: id, userId: request.userId },
      { $set: { title } },
      { new: true }
    );
    if (!conversation) return reply.code(404).send({ error: "Conversation not found" });
    return reply.send({ conversation: serializeConversation(conversation) });
  });

  app.delete("/api/conversations/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const conversation = await Conversation.findOneAndDelete({ _id: id, userId: request.userId });
    if (!conversation) return reply.code(404).send({ error: "Conversation not found" });

    await Message.deleteMany({ conversationId: id });
    await Attachment.deleteMany({ conversationId: id });
    await rm(attachmentsDirFor(id), { recursive: true, force: true });

    return reply.send({ ok: true });
  });

  app.get("/api/conversations/:id/messages", async (request, reply) => {
    const { id } = request.params as { id: string };
    const conversation = await Conversation.findOne({ _id: id, userId: request.userId });
    if (!conversation) return reply.code(404).send({ error: "Conversation not found" });

    const messages = await Message.find({ conversationId: id }).sort({ createdAt: 1 });
    return reply.send({ messages: messages.map(serializeMessage) });
  });

  app.post("/api/conversations/:id/messages", async (request, reply) => {
    const { id } = request.params as { id: string };
    const conversation = await Conversation.findOne({ _id: id, userId: request.userId });
    if (!conversation) return reply.code(404).send({ error: "Conversation not found" });

    const parsed = sendMessageSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid input", details: parsed.error.flatten() });
    }
    const { content, attachmentIds } = parsed.data;

    const attachmentDocs = attachmentIds.length
      ? await Attachment.find({ _id: { $in: attachmentIds }, conversationId: id })
      : [];
    const attachmentSnapshots = attachmentDocs.map((a) => ({
      id: String(a._id),
      filename: a.filename,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
    }));

    const userMessage = await Message.create({
      conversationId: id,
      role: "user",
      content,
      attachments: attachmentSnapshots.length ? attachmentSnapshots : undefined,
    });

    if (attachmentDocs.length) {
      await Attachment.updateMany(
        { _id: { $in: attachmentDocs.map((a) => a._id) } },
        { $set: { messageId: userMessage._id } }
      );
    }

    const isFirstMessage = conversation.title === "New chat";
    conversation.lastMessageAt = new Date();
    if (isFirstMessage) conversation.title = content.slice(0, 60) || "New chat";
    await conversation.save();

    return reply.code(201).send({ message: serializeMessage(userMessage) });
  });
}
