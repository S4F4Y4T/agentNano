import { tool, type StructuredToolInterface } from "@langchain/core/tools";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { requestContext } from "../utils/context.js";
import { ensureSandboxDir } from "../storage/sandbox.js";

const taskSchema = z.object({
  task: z.string().describe("Description of the task"),
  status: z.enum(["pending", "in_progress", "done"]).describe("Current status"),
});

export const updatePlanTool: StructuredToolInterface = tool(
  async ({ tasks }) => {
    const ctx = requestContext.getStore();
    if (!ctx?.conversationId) return "Error: No active conversation context.";
    try {
      const sandboxDir = await ensureSandboxDir(ctx.conversationId);
      const lines = tasks.map(
        (t, i) => {
          const icon = t.status === "done" ? "✓" : t.status === "in_progress" ? "→" : "○";
          return `${i + 1}. [${icon}] ${t.task}`;
        }
      );
      const content = `# Plan\n\n${lines.join("\n")}\n`;
      await mkdir(sandboxDir, { recursive: true });
      await writeFile(path.join(sandboxDir, "plan.md"), content, "utf8");
      const summary = tasks.map((t) => `${t.status === "done" ? "✓" : t.status === "in_progress" ? "→" : "○"} ${t.task}`).join(", ");
      return `Plan saved (${tasks.length} task${tasks.length === 1 ? "" : "s"}): ${summary}`;
    } catch (err) {
      return `Error saving plan: ${err instanceof Error ? err.message : err}`;
    }
  },
  {
    name: "update_plan",
    description:
      "Save or update your task plan. Always call this before starting multi-step work. Update statuses as you progress (pending → in_progress → done).",
    schema: z.object({
      tasks: z.array(taskSchema).min(1).describe("Ordered list of tasks with their current status"),
    }),
  }
);
