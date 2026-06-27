import type { FastifyInstance } from "fastify";
import path from "node:path";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { randomUUID } from "node:crypto";
import { Conversation } from "../db/models/Conversation.js";
import { Attachment } from "../db/models/Attachment.js";
import { authenticate } from "../middleware/authenticate.js";
import { ensureAttachmentsDir } from "../storage/attachments.js";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

export async function attachmentsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  app.post("/api/conversations/:id/attachments", async (request, reply) => {
    const { id } = request.params as { id: string };
    const conversation = await Conversation.findOne({ _id: id, userId: request.userId });
    if (!conversation) return reply.code(404).send({ error: "Conversation not found" });

    const file = await request.file({ limits: { fileSize: MAX_FILE_SIZE } });
    if (!file) return reply.code(400).send({ error: "No file uploaded" });

    const attachmentsDir = await ensureAttachmentsDir(id);
    const safeName = file.filename.replace(/[^\w.\-]+/g, "_");
    const relativePath = `${randomUUID().slice(0, 8)}_${safeName}`;
    const destPath = path.join(attachmentsDir, relativePath);

    await pipeline(file.file, createWriteStream(destPath));

    if (file.file.truncated) {
      return reply.code(413).send({ error: "File exceeds the 25MB limit" });
    }

    const attachment = await Attachment.create({
      conversationId: id,
      messageId: null,
      filename: file.filename,
      mimeType: file.mimetype || "application/octet-stream",
      sizeBytes: file.file.bytesRead,
      storageRelativePath: relativePath,
    });

    return reply.code(201).send({
      attachment: {
        id: String(attachment._id),
        filename: attachment.filename,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
      },
    });
  });
}
