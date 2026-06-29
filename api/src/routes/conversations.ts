import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../middleware/authenticate.js";
import {
  listConversations,
  createConversation,
  renameConversation,
  deleteConversation,
  listMessages,
  sendMessage,
  findOwnedConversation,
} from "../services/conversationService.js";
import { conversationEvents } from "../services/conversationEvents.js";

const sendMessageSchema = z.object({
  content: z.string().max(20_000),
  attachmentIds: z.array(z.string()).default([]),
});

export async function conversationsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  app.get("/api/conversations", async (request, reply) => {
    const { search } = request.query as { search?: string };
    const conversations = await listConversations(request.userId!, search);
    return reply.send({ conversations });
  });

  app.post("/api/conversations", async (request, reply) => {
    const conversation = await createConversation(request.userId!);
    return reply.code(201).send({ conversation });
  });

  app.patch("/api/conversations/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { title } = z.object({ title: z.string().min(1).max(200) }).parse(request.body);
    const conversation = await renameConversation(request.userId!, id, title);
    return reply.send({ conversation });
  });

  app.delete("/api/conversations/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await deleteConversation(request.userId!, id);
    return reply.send({ ok: true });
  });

  app.get("/api/conversations/:id/messages", async (request, reply) => {
    const { id } = request.params as { id: string };
    const messages = await listMessages(request.userId!, id);
    return reply.send({ messages });
  });

  app.get("/api/conversations/:id/events", async (request, reply) => {
    const { id } = request.params as { id: string };
    await findOwnedConversation(request.userId!, id);

    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    });
    // Flush a byte immediately — otherwise the stream sits unflushed (through
    // the proxy and the browser's own SSE parser) until the first real event,
    // which can be a long wait if nothing happens right after connecting.
    reply.raw.write(": connected\n\n");

    const onMessage = (message: unknown) => {
      reply.raw.write(`data: ${JSON.stringify({ type: "message", message })}\n\n`);
    };
    conversationEvents.on(id, onMessage);

    const heartbeat = setInterval(() => reply.raw.write(": ping\n\n"), 25_000);

    request.raw.on("close", () => {
      clearInterval(heartbeat);
      conversationEvents.off(id, onMessage);
    });
  });

  app.post("/api/conversations/:id/messages", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = sendMessageSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid input", details: parsed.error.flatten() });
    }

    const prepared = await sendMessage(request.userId!, id, parsed.data);

    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    });

    const send = (event: unknown) => reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);

    send({ type: "user_message", message: prepared.userMessage });
    const assistantMessage = await prepared.streamReply((token) => send({ type: "token", token }));
    send({ type: "done", reply: assistantMessage });

    reply.raw.end();
  });
}
