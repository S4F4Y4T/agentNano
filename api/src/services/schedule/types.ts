export interface CommandJobData {
  command: string;
  conversationId: string;
  userId: string;
  cron?: string;
}

export interface ScheduledTask {
  id: string;
  type: "once" | "cron";
  command: string;
  cron?: string;
  conversationId: string;
  nextRunAt?: string;
}

export interface PublicScheduledTask extends ScheduledTask {
  conversationTitle: string;
}
