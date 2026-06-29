import { randomUUID } from "node:crypto";
import { commandQueue } from "./queueConnection.js";
import { HttpError } from "../utils/httpError.js";

export async function scheduleOnceCommand(data: {
  command: string;
  conversationId: string;
  userId: string;
  delaySeconds: number;
}): Promise<string> {
  const job = await commandQueue.add(
    "delay-command",
    { command: data.command, conversationId: data.conversationId, userId: data.userId },
    { delay: Math.max(0, data.delaySeconds) * 1000 }
  );
  return job.id!;
}

export async function scheduleCronCommand(data: {
  command: string;
  conversationId: string;
  userId: string;
  cron: string;
}): Promise<string> {
  const schedulerId = randomUUID();
  await commandQueue.upsertJobScheduler(
    schedulerId,
    { pattern: data.cron },
    {
      name: "repeat-command",
      data: { command: data.command, conversationId: data.conversationId, userId: data.userId, cron: data.cron },
    }
  );
  return schedulerId;
}

export interface ScheduledTask {
  id: string;
  type: "once" | "cron";
  command: string;
  cron?: string;
  conversationId: string;
  nextRunAt?: string;
}

export async function listScheduledTasks(userId: string): Promise<ScheduledTask[]> {
  const [schedulers, delayed] = await Promise.all([
    commandQueue.getJobSchedulers(),
    commandQueue.getDelayed(),
  ]);

  const cronTasks: ScheduledTask[] = schedulers
    .filter((s) => s.template?.data?.userId === userId)
    .map((s) => ({
      id: s.key,
      type: "cron" as const,
      command: s.template!.data!.command,
      cron: s.pattern,
      conversationId: s.template!.data!.conversationId,
      nextRunAt: s.next ? new Date(s.next).toISOString() : undefined,
    }));

  // Job Schedulers spawn their next concrete occurrence as a regular delayed
  // job (carrying the same `cron` field) — skip those here so a recurring
  // task doesn't also show up as a one-off.
  const onceTasks: ScheduledTask[] = delayed
    .filter((j) => j.data?.userId === userId && !j.data?.cron)
    .map((j) => ({
      id: String(j.id),
      type: "once" as const,
      command: j.data.command,
      conversationId: j.data.conversationId,
      nextRunAt: new Date(j.timestamp + j.delay).toISOString(),
    }));

  return [...cronTasks, ...onceTasks].sort((a, b) =>
    (a.nextRunAt ?? "").localeCompare(b.nextRunAt ?? "")
  );
}

export async function cancelScheduledTask(
  userId: string,
  id: string,
  type: "once" | "cron"
): Promise<void> {
  if (type === "cron") {
    const schedulers = await commandQueue.getJobSchedulers();
    const owns = schedulers.some((s) => s.key === id && s.template?.data?.userId === userId);
    if (!owns) throw new HttpError(404, "Scheduled task not found");
    await commandQueue.removeJobScheduler(id);
    return;
  }

  const job = await commandQueue.getJob(id);
  if (!job || job.data?.userId !== userId) throw new HttpError(404, "Scheduled task not found");
  await job.remove();
}
