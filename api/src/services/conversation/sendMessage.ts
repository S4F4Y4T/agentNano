import { Message } from "../../db/models/Message.js";
import { Attachment } from "../../db/models/Attachment.js";
import { AgentConfig } from "../../db/models/AgentConfig.js";
import { decryptSecret } from "../../utils/crypto.js";
import { runAgent } from "../../agent/runAgent.js";
import { HttpError } from "../../utils/httpError.js";
import { requestContext } from "../../utils/context.js";
import { findOwnedConversation } from "./crud.js";
import { serializeMessage } from "./serializers.js";
import { loadRecentMessages, buildAgentHistory, MAX_HISTORY_MESSAGES } from "./history.js";
import type { PreparedMessage } from "./types.js";

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

  // Reserve one slot in the context window for the user message created below.
  const priorMessages = await loadRecentMessages(conversationId, MAX_HISTORY_MESSAGES - 1);

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

  const history = await buildAgentHistory(conversationId, [...priorMessages, userMessage]);

  return {
    userMessage: serializeMessage(userMessage),
    streamReply: async (onToken) => {
      let replyContent = "";
      try {
        replyContent = await requestContext.run({ userId, conversationId }, () =>
          runAgent({
            config: {
              providerType: agentConfig.providerType,
              baseUrl: agentConfig.baseUrl,
              apiKey: decryptSecret(agentConfig.apiKeyEncrypted),
              model: agentConfig.model,
            },
            systemPrompt: agentConfig.systemPrompt,
            history,
            onToken,
          })
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
