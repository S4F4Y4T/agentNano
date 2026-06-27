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
} from "../services/conversationService.js";

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

  app.post("/api/conversations/:id/messages", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = sendMessageSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid input", details: parsed.error.flatten() });
    }

    const result = await sendMessage(request.userId!, id, parsed.data);
    return reply.code(201).send(result);
  });
}
