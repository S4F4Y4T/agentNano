"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useAppData } from "@/lib/app-data";
import { Button } from "@/components/ui/button";
import { DeskAgentLogo } from "@/components/deskagent-logo";

export default function ChatIndexPage() {
  const router = useRouter();
  const { conversations, conversationsLoaded, agentConfig, createConversation } = useAppData();

  const mostRecent = [...conversations].sort(
    (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
  )[0];

  useEffect(() => {
    if (mostRecent) router.replace(`/chat/${mostRecent.id}`);
  }, [mostRecent, router]);

  if (mostRecent) return null;

  if (!conversationsLoaded) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleNewChat = async () => {
    if (!agentConfig) {
      toast.error("Configure your agent first.");
      router.push("/configure");
      return;
    }
    const id = await createConversation();
    router.push(`/chat/${id}`);
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <DeskAgentLogo iconOnly className="scale-150" />
      <div className="space-y-1">
        <p className="text-sm font-medium">No conversations yet.</p>
        <p className="text-sm text-muted-foreground">Start one to talk to DeskAgent.</p>
      </div>
      <Button onClick={handleNewChat}>
        <Plus className="size-4" />
        New chat
      </Button>
    </div>
  );
}
