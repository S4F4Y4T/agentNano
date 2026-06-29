export interface ChatHistoryItem {
  role: "user" | "assistant" | "system";
  content: string;
  attachments?: {
    filename: string;
    mimeType: string;
    filePath: string;
  }[];
}
