export interface PublicConversation {
  id: string;
  title: string;
  lastMessageAt: string;
  createdAt: string;
}

export interface PublicMessage {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  attachments?: unknown;
  createdAt: string;
}

export interface PreparedMessage {
  userMessage: PublicMessage;
  streamReply: (onToken: (token: string) => void) => Promise<PublicMessage>;
}
