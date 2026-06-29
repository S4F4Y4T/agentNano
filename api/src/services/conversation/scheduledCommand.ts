/**
 * Shared contract between the scheduled-command worker (which writes this
 * marker into a message's content) and the agent-history builder (which
 * reads it back out). Kept in one place so the two sides can't drift apart.
 */
export const SCHEDULED_COMMAND_MARKER = "**[Scheduled Command Executed]**";

export function formatScheduledCommandContent(command: string, success: boolean, output: string): string {
  return `${SCHEDULED_COMMAND_MARKER}\nCommand: \`${command}\`\nStatus: ${success ? "✅ Success" : "❌ Failed"}\n\nOutput:\n\`\`\`bash\n${output.trim()}\n\`\`\``;
}

export function isScheduledCommandMessage(content: string): boolean {
  return content.startsWith(SCHEDULED_COMMAND_MARKER);
}

/** Defensive: strips a scheduled-command block that appears after other text in the same message. */
export function stripTrailingScheduledCommandMarker(content: string): string {
  const idx = content.indexOf(SCHEDULED_COMMAND_MARKER);
  return idx === -1 ? content : content.slice(0, idx).trim();
}

export function wrapAsSystemNotification(content: string): string {
  return `[Background System Notification: The following scheduled command was executed automatically]\n${content}`;
}
