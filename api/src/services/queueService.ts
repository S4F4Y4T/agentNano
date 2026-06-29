import { Queue, Worker, Job } from "bullmq";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { env } from "../config/env.js";
import { Message } from "../db/models/Message.js";
import { Conversation } from "../db/models/Conversation.js";

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
  cron?: string;
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
      
      await Message.create({
        conversationId,
        role: "assistant",
        content,
      });

      await Conversation.findByIdAndUpdate(conversationId, {
        $set: { lastMessageAt: new Date() }
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
