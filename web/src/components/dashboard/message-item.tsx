"use client";

import { Paperclip } from "lucide-react";
import { useAppData } from "@/lib/app-data";
import { formatBytes } from "@/lib/format";
import { Markdown } from "@/components/dashboard/markdown";
import { AgentNanoLogo } from "@/components/agentnano-logo";
import type { Message } from "@/lib/types";

export function MessageItem({
  message,
  agentName,
}: {
  message: Message;
  agentName: string;
}) {
  const { session } = useAppData();
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div className="shrink-0 pt-0.5">
        {isUser ? (
          <span className="flex size-7 items-center justify-center rounded-md bg-secondary text-xs font-medium text-secondary-foreground">
            {session?.name?.[0]?.toUpperCase() ?? "U"}
          </span>
        ) : (
          <AgentNanoLogo iconOnly />
        )}
      </div>
      <div className={`min-w-0 flex-1 space-y-2 pt-0.5 ${isUser ? "text-right" : ""}`}>
        <p className="text-sm font-medium">{isUser ? "You" : agentName}</p>

        {message.attachments && message.attachments.length > 0 && (
          <div className={`flex flex-wrap gap-1.5 ${isUser ? "justify-end" : ""}`}>
            {message.attachments.map((a) => (
              <span
                key={a.id}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-2 py-1 text-xs text-muted-foreground"
              >
                <Paperclip className="size-3" />
                {a.filename}
                <span className="text-muted-foreground/70">
                  {formatBytes(a.sizeBytes)}
                </span>
              </span>
            ))}
          </div>
        )}

        {!isUser && message.streaming && (
          <div className="flex items-center gap-1 py-1" aria-label={`${agentName} is thinking`}>
            <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.3s]" />
            <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.15s]" />
            <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60" />
          </div>
        )}

        {message.content ? <Markdown content={message.content} /> : null}
      </div>
    </div>
  );
}
