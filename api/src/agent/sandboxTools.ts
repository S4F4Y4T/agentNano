import { tool, type StructuredToolInterface } from "@langchain/core/tools";
import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { requestContext } from "../utils/context.js";
import { ensureSandboxDir, resolveSandboxPath } from "../storage/sandbox.js";

async function getSandboxDir(): Promise<string> {
  const ctx = requestContext.getStore();
  if (!ctx?.conversationId) throw new Error("No active conversation context for sandbox");
  return ensureSandboxDir(ctx.conversationId);
}

export const writeFileTool = tool(
  async ({ path: filePath, content }) => {
    try {
      const sandboxDir = await getSandboxDir();
      const resolved = resolveSandboxPath(sandboxDir, filePath);
      await mkdir(path.dirname(resolved), { recursive: true });
      await writeFile(resolved, content, "utf8");
      return `Written ${content.length} characters to ${filePath}`;
    } catch (err) {
      return `Error writing file: ${err instanceof Error ? err.message : err}`;
    }
  },
  {
    name: "write_file",
    description: "Write or overwrite a file in your sandbox. Use relative paths (e.g. 'notes.md', 'results/output.txt').",
    schema: z.object({
      path: z.string().describe("Relative file path inside the sandbox"),
      content: z.string().describe("Text content to write"),
    }),
  }
);

export const readFileTool = tool(
  async ({ path: filePath }) => {
    try {
      const sandboxDir = await getSandboxDir();
      const resolved = resolveSandboxPath(sandboxDir, filePath);
      if (!existsSync(resolved)) return `File not found: ${filePath}`;
      const content = await readFile(resolved, "utf8");
      return content || "(empty file)";
    } catch (err) {
      return `Error reading file: ${err instanceof Error ? err.message : err}`;
    }
  },
  {
    name: "read_file",
    description: "Read a file from your sandbox. Returns the file content as text.",
    schema: z.object({
      path: z.string().describe("Relative file path inside the sandbox"),
    }),
  }
);

export const listFilesTool = tool(
  async ({ path: dirPath }) => {
    try {
      const sandboxDir = await getSandboxDir();
      const targetDir = dirPath
        ? resolveSandboxPath(sandboxDir, dirPath)
        : sandboxDir;
      if (!existsSync(targetDir)) return `Directory not found: ${dirPath ?? "/"}`;
      const entries = await readdir(targetDir, { withFileTypes: true });
      if (entries.length === 0) return "Directory is empty";
      return entries
        .map((e) => `${e.isDirectory() ? "[dir] " : "      "}${e.name}`)
        .join("\n");
    } catch (err) {
      return `Error listing files: ${err instanceof Error ? err.message : err}`;
    }
  },
  {
    name: "list_files",
    description: "List files and directories in your sandbox (or a subdirectory).",
    schema: z.object({
      path: z.string().optional().describe("Relative path of the directory to list (omit for sandbox root)"),
    }),
  }
);

export const sandboxTools: StructuredToolInterface[] = [writeFileTool, readFileTool, listFilesTool];
