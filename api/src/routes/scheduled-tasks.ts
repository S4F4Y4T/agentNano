import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../middleware/authenticate.js";
import { listScheduledTasksForUser, cancelScheduledTask } from "../services/schedule/index.js";

const cancelQuerySchema = z.object({ type: z.enum(["once", "cron"]) });

export async function scheduledTasksRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  app.get("/api/scheduled-tasks", async (request, reply) => {
    const tasks = await listScheduledTasksForUser(request.userId!);
    return reply.send({ tasks });
  });

  app.delete("/api/scheduled-tasks/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { type } = cancelQuerySchema.parse(request.query);

    await cancelScheduledTask(request.userId!, id, type);
    return reply.send({ ok: true });
  });
}
