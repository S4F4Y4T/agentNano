import { Queue, Worker, Job } from "bullmq";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import { Message } from "../db/models/Message.js";
import { Conversation } from "../db/models/Conversation.js";
import { emitConversationMessage } from "./conversationEvents.js";

const execAsync = promisify(exec);

const redisUrl = new URL(env.REDIS_URL);
const connection = {
  host: redisUrl.hostname,
  port: parseInt(redisUrl.port || "6379", 10),
  username: redisUrl.username || undefined,
  password: redisUrl.password || undefined,
  maxRetriesPerRequest: null,
};

export const commandQueue = new Queue("agent-commands", {
  connection,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: false,
  },
});

export interface CommandJobData {
  command: string;
  conversationId: string;
  userId: string;
  cron?: string;
}

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
): Promise<boolean> {
  if (type === "cron") {
    const schedulers = await commandQueue.getJobSchedulers();
    const owns = schedulers.some((s) => s.key === id && s.template?.data?.userId === userId);
    if (!owns) return false;
    return commandQueue.removeJobScheduler(id);
  }

  const job = await commandQueue.getJob(id);
  if (!job || job.data?.userId !== userId) return false;
  await job.remove();
  return true;
}

export const commandWorker = new Worker<CommandJobData>(
  "agent-commands",
  async (job: Job<CommandJobData>) => {
    const { command, conversationId } = job.data;
    console.log(`[Worker] Running scheduled command: "${command}" for conversation: ${conversationId}`);

    let output = "";
    let success = true;

    try {
      const { stdout, stderr } = await execAsync(command);
      output = stdout || stderr || "(Command executed successfully with no output)";
    } catch (err: any) {
      success = false;
      output = err.message || String(err);
    }

    // Save output message to conversation
    try {
      const content = `**[Scheduled Command Executed]**\nCommand: \`${command}\`\nStatus: ${success ? "✅ Success" : "❌ Failed"}\n\nOutput:\n\`\`\`bash\n${output.trim()}\n\`\`\``;

      const message = await Message.create({
        conversationId,
        role: "assistant",
        content,
      });

      await Conversation.findByIdAndUpdate(conversationId, {
        $set: { lastMessageAt: new Date() }
      });

      emitConversationMessage(conversationId, {
        id: String(message._id),
        conversationId,
        role: "assistant",
        content,
        createdAt: message.createdAt.toISOString(),
      });

      console.log(`[Worker] Saved output for job ${job.id}`);
    } catch (dbErr) {
      console.error("[Worker] Failed to save command output to MongoDB:", dbErr);
    }
  },
  {
    connection,
  }
);

commandWorker.on("completed", (job) => {
  console.log(`[Worker] Job ${job?.id} completed successfully`);
});

commandWorker.on("failed", (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed:`, err);
});
