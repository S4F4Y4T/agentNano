import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestContext {
  userId: string;
  conversationId: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();
