import type { FastifyInstance } from "fastify";
import { authenticate } from "../middleware/authenticate.js";
import { uploadAttachment, MAX_FILE_SIZE } from "../services/attachmentService.js";

export async function attachmentsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  app.post("/api/conversations/:id/attachments", async (request, reply) => {
    const { id } = request.params as { id: string };
    const file = await request.file({ limits: { fileSize: MAX_FILE_SIZE } });
    const attachment = await uploadAttachment(request.userId!, id, file);
    return reply.code(201).send({ attachment });
  });
}
