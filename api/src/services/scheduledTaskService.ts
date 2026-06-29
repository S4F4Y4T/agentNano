import { Conversation } from "../db/models/Conversation.js";
import { listScheduledTasks, type ScheduledTask } from "./queueService.js";

export interface PublicScheduledTask extends ScheduledTask {
  conversationTitle: string;
}

export async function listScheduledTasksForUser(userId: string): Promise<PublicScheduledTask[]> {
  const tasks = await listScheduledTasks(userId);
  const conversationIds = [...new Set(tasks.map((t) => t.conversationId))];
  const conversations = await Conversation.find({ _id: { $in: conversationIds } }, { title: 1 });
  const titleById = new Map(conversations.map((c) => [String(c._id), c.title]));

  return tasks.map((t) => ({
    ...t,
    conversationTitle: titleById.get(t.conversationId) ?? "Deleted conversation",
  }));
}
