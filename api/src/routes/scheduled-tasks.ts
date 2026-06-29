import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../middleware/authenticate.js";
import { listScheduledTasksForUser } from "../services/scheduledTaskService.js";
import { cancelScheduledTask } from "../services/queueService.js";

const cancelQuerySchema = z.object({ type: z.enum(["once", "cron"]) });

export async function scheduledTasksRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  app.get("/api/scheduled-tasks", async (request, reply) => {
    const tasks = await listScheduledTasksForUser(request.userId!);
    return reply.send({ tasks });
  });

  app.delete("/api/scheduled-tasks/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = cancelQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid input", details: parsed.error.flatten() });
    }

    const cancelled = await cancelScheduledTask(request.userId!, id, parsed.data.type);
    if (!cancelled) {
      return reply.code(404).send({ error: "Scheduled task not found" });
    }
    return reply.send({ ok: true });
  });
}
