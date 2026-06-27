import path from "node:path";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { randomUUID } from "node:crypto";
import type { MultipartFile } from "@fastify/multipart";
import { Conversation } from "../db/models/Conversation.js";
import { Attachment } from "../db/models/Attachment.js";
import { ensureAttachmentsDir } from "../storage/attachments.js";
import { HttpError } from "../utils/httpError.js";

export interface PublicAttachment {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

export async function uploadAttachment(
  userId: string,
  conversationId: string,
  file: MultipartFile | undefined
): Promise<PublicAttachment> {
  const conversation = await Conversation.findOne({ _id: conversationId, userId });
  if (!conversation) {
    throw new HttpError(404, "Conversation not found");
  }
  if (!file) {
    throw new HttpError(400, "No file uploaded");
  }

  const attachmentsDir = await ensureAttachmentsDir(conversationId);
  const safeName = file.filename.replace(/[^\w.\-]+/g, "_");
  const relativePath = `${randomUUID().slice(0, 8)}_${safeName}`;
  const destPath = path.join(attachmentsDir, relativePath);

  await pipeline(file.file, createWriteStream(destPath));

  if (file.file.truncated) {
    throw new HttpError(413, "File exceeds the 25MB limit");
  }

  const attachment = await Attachment.create({
    conversationId,
    messageId: null,
    filename: file.filename,
    mimeType: file.mimetype || "application/octet-stream",
    sizeBytes: file.file.bytesRead,
    storageRelativePath: relativePath,
  });

  return {
    id: String(attachment._id),
    filename: attachment.filename,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
  };
}

export { MAX_FILE_SIZE };
