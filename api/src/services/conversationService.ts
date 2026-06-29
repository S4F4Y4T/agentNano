import { rm } from "node:fs/promises";
import path from "node:path";
import { Conversation } from "../db/models/Conversation.js";
import { Message } from "../db/models/Message.js";
import { Attachment } from "../db/models/Attachment.js";
import { AgentConfig } from "../db/models/AgentConfig.js";
import { attachmentsDirFor } from "../storage/attachments.js";
import { decryptSecret } from "../utils/crypto.js";
import { answerMessage } from "../chat/answerMessage.js";
import { HttpError } from "../utils/httpError.js";
import { requestContext } from "../utils/context.js";

export interface PublicConversation {
  id: string;
  title: string;
  lastMessageAt: string;
  createdAt: string;
}

export interface PublicMessage {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  attachments?: unknown;
  createdAt: string;
}

function serializeConversation(c: {
  _id: unknown;
  title: string;
  lastMessageAt: Date;
  createdAt: Date;
}): PublicConversation {
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
}): PublicMessage {
  return {
    id: String(m._id),
    conversationId: String(m.conversationId),
    role: m.role,
    content: m.content,
    attachments: m.attachments ?? undefined,
    createdAt: m.createdAt.toISOString(),
  };
}

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

export interface PreparedMessage {
  userMessage: PublicMessage;
  streamReply: (onToken: (token: string) => void) => Promise<PublicMessage>;
}

export async function sendMessage(
  userId: string,
  conversationId: string,
  input: { content: string; attachmentIds: string[] }
): Promise<PreparedMessage> {
  const conversation = await findOwnedConversation(userId, conversationId);

  const agentConfig = await AgentConfig.findOne({ userId });
  if (!agentConfig) {
    throw new HttpError(400, "Configure your agent before chatting");
  }

  const priorMessages = await Message.find({ conversationId }).sort({ createdAt: 1 });

  const attachmentDocs = input.attachmentIds.length
    ? await Attachment.find({ _id: { $in: input.attachmentIds }, conversationId })
    : [];
  const attachmentSnapshots = attachmentDocs.map((a) => ({
    id: String(a._id),
    filename: a.filename,
    mimeType: a.mimeType,
    sizeBytes: a.sizeBytes,
  }));

  const userMessage = await Message.create({
    conversationId,
    role: "user",
    content: input.content,
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
  if (isFirstMessage) conversation.title = input.content.slice(0, 60) || "New chat";
  await conversation.save();

  const allMessages = [...priorMessages, userMessage].slice(-40);
  const allMessageIds = allMessages.map((m) => m._id);
  const attachmentsForHistory = await Attachment.find({ messageId: { $in: allMessageIds } });

  const attachmentsByMessageId = new Map<string, any[]>();
  for (const att of attachmentsForHistory) {
    if (att.messageId) {
      const key = String(att.messageId);
      if (!attachmentsByMessageId.has(key)) {
        attachmentsByMessageId.set(key, []);
      }
      attachmentsByMessageId.get(key)!.push(att);
    }
  }

  const history = allMessages.map((m) => {
    const key = String(m._id);
    const messageAttachments = attachmentsByMessageId.get(key) || [];
    const isScheduledCommand = m.role === "assistant" && m.content.startsWith("**[Scheduled Command Executed]**");
    
    let content = m.content;
    if (m.role === "assistant" && !isScheduledCommand) {
      const idx = content.indexOf("**[Scheduled Command Executed]**");
      if (idx !== -1) {
        content = content.slice(0, idx).trim();
      }
    }

    return {
      role: isScheduledCommand ? ("system" as const) : (m.role as "user" | "assistant"),
      content: isScheduledCommand
        ? `[Background System Notification: The following scheduled command was executed automatically]\n${content}`
        : content,
      attachments: messageAttachments.map((att) => ({
        filename: att.filename,
        mimeType: att.mimeType,
        filePath: path.join(attachmentsDirFor(conversationId), att.storageRelativePath),
      })),
    };
  });

  return {
    userMessage: serializeMessage(userMessage),
    streamReply: async (onToken) => {
      let replyContent = "";
      try {
        replyContent = await requestContext.run({ userId, conversationId }, () =>
          answerMessage(
            {
              providerType: agentConfig.providerType,
              baseUrl: agentConfig.baseUrl,
              apiKey: decryptSecret(agentConfig.apiKeyEncrypted),
              model: agentConfig.model,
            },
            agentConfig.systemPrompt,
            history,
            onToken
          )
        );
      } catch {
        replyContent = "Couldn't reach the provider. Check the API key and try again.";
        onToken(replyContent);
      }

      const assistantMessage = await Message.create({
        conversationId,
        role: "assistant",
        content: replyContent,
      });
      conversation.lastMessageAt = new Date();
      await conversation.save();

      return serializeMessage(assistantMessage);
    },
  };
}
