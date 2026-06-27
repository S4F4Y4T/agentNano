"use client";

import { useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, Plus, Settings } from "lucide-react";
import { useAppData } from "@/lib/app-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageItem } from "@/components/dashboard/message-item";
import { Composer } from "@/components/dashboard/composer";
import { AgentNanoLogo } from "@/components/agentnano-logo";

export default function ChatConversationPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const {
    conversations,
    conversationsLoaded,
    agentConfig,
    messagesByConversation,
    createConversation,
    ensureMessagesLoaded,
  } = useAppData();
  const bottomRef = useRef<HTMLDivElement>(null);

  const conversation = conversations.find((c) => c.id === params.id);
  const messages = messagesByConversation[params.id] ?? [];
  const lastMessageContent = messages[messages.length - 1]?.content;

  useEffect(() => {
    ensureMessagesLoaded(params.id);
  }, [params.id, ensureMessagesLoaded]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, lastMessageContent]);

  if (!conversationsLoaded) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm text-muted-foreground">
          This conversation doesn&apos;t exist anymore.
        </p>
        <Button size="sm" variant="outline" onClick={() => router.push("/chat")}>
          Back to chat
        </Button>
      </div>
    );
  }

  if (!agentConfig) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <AgentNanoLogo iconOnly className="scale-150" />
        <p className="text-sm text-muted-foreground">
          Configure your agent before chatting.
        </p>
        <Button size="sm" onClick={() => router.push("/configure")}>
          <Settings className="size-3.5" />
          Configure your agent
        </Button>
      </div>
    );
  }

  const handleNewChat = async () => {
    const id = await createConversation();
    router.push(`/chat/${id}`);
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{conversation.title}</p>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>AgentNano</span>
            <span>·</span>
            <Badge variant="outline" className="h-5 px-1.5 font-mono text-[11px] font-normal">
              {agentConfig.model}
            </Badge>
            {agentConfig.status === "error" && (
              <span className="text-destructive">Provider connection failing</span>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleNewChat}>
          <Plus className="size-3.5" />
          New chat
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <AgentNanoLogo iconOnly className="scale-150" />
            <p className="text-sm text-muted-foreground">
              Ask AgentNano anything to get started.
            </p>
          </div>
        ) : (
          <div className="mx-auto flex max-w-[880px] flex-col gap-6 px-6 py-6">
            {messages.map((message) => (
              <MessageItem key={message.id} message={message} agentName="AgentNano" />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="mx-auto w-full max-w-[880px] px-6 pb-6">
        <Composer conversationId={conversation.id} agentName="AgentNano" />
      </div>
    </div>
  );
}
