import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../middleware/authenticate.js";
import { Memory } from "../db/models/Memory.js";

const createMemorySchema = z.object({
  content: z.string().min(1).max(2000),
});

export async function memoriesRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  app.get("/api/memories", async (request, reply) => {
    const memories = await Memory.find({ userId: request.userId! }).sort({ createdAt: -1 });
    return reply.send({
      memories: memories.map((m) => ({
        id: String(m._id),
        content: m.content,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  });

  app.post("/api/memories", async (request, reply) => {
    const { content } = createMemorySchema.parse(request.body);
    const memory = await Memory.create({
      userId: request.userId!,
      content,
    });
    return reply.code(201).send({
      memory: {
        id: String(memory._id),
        content: memory.content,
        createdAt: memory.createdAt.toISOString(),
      },
    });
  });

  app.delete("/api/memories/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const res = await Memory.deleteOne({ _id: id, userId: request.userId! });
    if (res.deletedCount === 0) {
      return reply.code(404).send({ error: "Memory not found" });
    }
    return reply.send({ ok: true });
  });
}
