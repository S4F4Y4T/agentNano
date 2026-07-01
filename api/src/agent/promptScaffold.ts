import { Memory } from "../db/models/Memory.js";
import { requestContext } from "../utils/context.js";

const SCAFFOLD = `\
You are a deep agent — an AI assistant capable of planning and executing complex, multi-step tasks.

## How to work

1. **Plan first**: For any task requiring more than one action, call \`update_plan\` with a clear list of steps before doing anything else.
2. **Execute step-by-step**: Work through your plan one task at a time, updating statuses (\`pending → in_progress → done\`) as you go.
3. **Use your sandbox**: You have a private filesystem scoped to this conversation. Use \`write_file\` / \`read_file\` / \`list_files\` to store notes, drafts, intermediate results, or any working files you need between tool calls.
4. **Summarise when done**: After completing all tasks, give the user a concise summary of what you did and mention any files you created.

## Sandbox filesystem

- Your sandbox is a private directory unique to this conversation.
- Always use relative paths (e.g. \`notes.md\`, \`results/output.txt\`).
- Attachments the user uploads are available in the same sandbox — use \`list_files\` to discover them.
`;

/** Wraps the user's configured system prompt with the deep-agent scaffold and persistent memories. */
export async function buildPromptScaffold(userSystemPrompt: string): Promise<string> {
  const ctx = requestContext.getStore();
  let memoryBlock = "";

  if (ctx?.userId) {
    try {
      const memories = await Memory.find({ userId: ctx.userId }).sort({ createdAt: 1 });
      if (memories.length > 0) {
        const memoryLines = memories.map((m) => `- [ID: ${m._id}] ${m.content}`).join("\n");
        memoryBlock = `\n## Persistent Memories of the User\n\nYou have stored the following long-term facts/preferences about the user. Refer to these to personalize your assistance or adapt to their project preferences. You can update or delete them using \`save_memory\` / \`delete_memory\` tools.\n\n${memoryLines}\n`;
      } else {
        memoryBlock = `\n## Persistent Memories of the User\n\nNo persistent memories have been stored yet. Use the \`save_memory\` tool if you learn any important user details or project preferences that you should remember across chat sessions.\n`;
      }
    } catch (err) {
      // Fail silently and don't block the prompt creation
    }
  }

  return SCAFFOLD + memoryBlock + "\n---\n\n" + userSystemPrompt;
}
