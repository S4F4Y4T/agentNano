import { Worker, type Job } from "bullmq";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { redisConnection } from "./connection.js";
import type { CommandJobData } from "./types.js";
import { Message } from "../../db/models/Message.js";
import { Conversation } from "../../db/models/Conversation.js";
import { emitConversationMessage } from "../conversationEvents.js";
import { formatScheduledCommandContent } from "../conversation/scheduledCommand.js";
import { logger } from "../../utils/logger.js";

const execAsync = promisify(exec);

async function processCommandJob(job: Job<CommandJobData>) {
  const { command, conversationId } = job.data;
  logger.info({ command, conversationId, jobId: job.id }, "running scheduled command");

  let output = "";
  let success = true;

  try {
    const { stdout, stderr } = await execAsync(command);
    output = stdout || stderr || "(Command executed successfully with no output)";
  } catch (err: any) {
    success = false;
    output = err.message || String(err);
  }

  try {
    const content = formatScheduledCommandContent(command, success, output);

    const message = await Message.create({
      conversationId,
      role: "assistant",
      content,
    });

    await Conversation.findByIdAndUpdate(conversationId, {
      $set: { lastMessageAt: new Date() },
    });

    emitConversationMessage(conversationId, {
      id: String(message._id),
      conversationId,
      role: "assistant",
      content,
      createdAt: message.createdAt.toISOString(),
    });

    logger.info({ jobId: job.id }, "saved scheduled command output");
  } catch (dbErr) {
    logger.error({ err: dbErr, jobId: job.id }, "failed to save scheduled command output");
  }
}

export function startCommandWorker(): Worker<CommandJobData> {
  const worker = new Worker<CommandJobData>("agent-commands", processCommandJob, {
    connection: redisConnection,
  });

  worker.on("completed", (job) => {
    logger.info({ jobId: job?.id }, "scheduled command job completed");
  });

  worker.on("failed", (job, err) => {
    logger.error({ err, jobId: job?.id }, "scheduled command job failed");
  });

  return worker;
}
