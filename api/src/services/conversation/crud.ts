import { rm } from "node:fs/promises";
import { Conversation } from "../../db/models/Conversation.js";
import { Message } from "../../db/models/Message.js";
import { Attachment } from "../../db/models/Attachment.js";
import { attachmentsDirFor } from "../../storage/attachments.js";
import { HttpError } from "../../utils/httpError.js";
import { serializeConversation, serializeMessage } from "./serializers.js";
import type { PublicConversation, PublicMessage } from "./types.js";

export async function findOwnedConversation(userId: string, conversationId: string) {
  const conversation = await Conversation.findOne({ _id: conversationId, userId });
  if (!conversation) {
    throw new HttpError(404, "Conversation not found");
  }
  return conversation;
}

export async function listConversations(
  userId: string,
  search?: string
): Promise<PublicConversation[]> {
  const filter: Record<string, unknown> = { userId };
  if (search && search.trim()) {
    filter.title = { $regex: search.trim(), $options: "i" };
  }
  const conversations = await Conversation.find(filter).sort({ lastMessageAt: -1 });
  return conversations.map(serializeConversation);
}

export async function createConversation(userId: string): Promise<PublicConversation> {
  const conversation = await Conversation.create({ userId, title: "New chat" });
  return serializeConversation(conversation);
}

export async function renameConversation(
  userId: string,
  conversationId: string,
  title: string
): Promise<PublicConversation> {
  const conversation = await Conversation.findOneAndUpdate(
    { _id: conversationId, userId },
    { $set: { title } },
    { new: true }
  );
  if (!conversation) {
    throw new HttpError(404, "Conversation not found");
  }
  return serializeConversation(conversation);
}

export async function deleteConversation(userId: string, conversationId: string): Promise<void> {
  const conversation = await Conversation.findOneAndDelete({ _id: conversationId, userId });
  if (!conversation) {
    throw new HttpError(404, "Conversation not found");
  }

  await Message.deleteMany({ conversationId });
  await Attachment.deleteMany({ conversationId });
  await rm(attachmentsDirFor(conversationId), { recursive: true, force: true });
}

export async function listMessages(
  userId: string,
  conversationId: string
): Promise<PublicMessage[]> {
  await findOwnedConversation(userId, conversationId);
  const messages = await Message.find({ conversationId }).sort({ createdAt: 1 });
  return messages.map(serializeMessage);
}
