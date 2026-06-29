import { EventEmitter } from "node:events";

export const conversationEvents = new EventEmitter();

export function emitConversationMessage(conversationId: string, message: unknown) {
  conversationEvents.emit(conversationId, message);
}
