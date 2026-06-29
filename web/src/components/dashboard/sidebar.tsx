"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Check,
  Clock,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Settings,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppData } from "@/lib/app-data";
import { formatRelativeTime } from "@/lib/format";
import { AgentNanoLogo } from "@/components/agentnano-logo";
import { UserMenu } from "@/components/dashboard/user-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const NAV_ITEMS = [
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/tasks", label: "Scheduled tasks", icon: Clock },
  { href: "/configure", label: "Configure", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { conversations, createConversation, renameConversation, deleteConversation } =
    useAppData();

  const [search, setSearch] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const showThreads = pathname.startsWith("/chat");

  const threads = useMemo(() => {
    return conversations
      .filter((c) => c.title.toLowerCase().includes(search.toLowerCase()))
      .sort(
        (a, b) =>
          new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
      );
  }, [conversations, search]);

  const handleNewChat = async () => {
    const id = await createConversation();
    router.push(`/chat/${id}`);
  };

  const commitRename = (id: string) => {
    if (renameValue.trim()) renameConversation(id, renameValue.trim());
    setRenamingId(null);
  };

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex items-center px-3 py-3">
        <AgentNanoLogo />
      </div>

      <nav className="flex flex-col gap-0.5 px-2">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="size-4" strokeWidth={1.5} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="my-2 h-px bg-sidebar-border" />

      {showThreads && (
        <>
          <div className="flex flex-col gap-2 px-2">
            <Button onClick={handleNewChat} className="w-full justify-start">
              <Plus className="size-4" />
              New chat
            </Button>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search chats"
                className="h-8 pl-8 text-sm"
              />
            </div>
          </div>

          <ScrollArea className="mt-2 flex-1 px-2">
            <div className="flex flex-col gap-0.5 pb-2">
              {threads.length === 0 && (
                <p className="px-2.5 py-4 text-center text-xs text-muted-foreground">
                  No conversations yet.
                </p>
              )}
              {threads.map((thread) => {
                const active = pathname === `/chat/${thread.id}`;
                const isRenaming = renamingId === thread.id;
                return (
                  <div
                    key={thread.id}
                    className={cn(
                      "group flex items-center gap-1 rounded-md px-2.5 py-1.5",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "hover:bg-sidebar-accent/60"
                    )}
                  >
                    {isRenaming ? (
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => commitRename(thread.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitRename(thread.id);
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                        className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                      />
                    ) : (
                      <Link href={`/chat/${thread.id}`} className="min-w-0 flex-1 text-sm">
                        <div className="truncate">{thread.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatRelativeTime(thread.lastMessageAt)}
                        </div>
                      </Link>
                    )}
                    {!isRenaming && (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <button
                              className="shrink-0 rounded-sm p-1 text-muted-foreground opacity-0 hover:bg-sidebar-accent group-hover:opacity-100 data-popup-open:opacity-100"
                              aria-label="Thread options"
                            />
                          }
                        >
                          <MoreHorizontal className="size-3.5" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setRenamingId(thread.id);
                              setRenameValue(thread.title);
                            }}
                          >
                            <Pencil className="size-3.5" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setDeleteTargetId(thread.id)}
                          >
                            <Trash2 className="size-3.5" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </>
      )}

      <div className="mt-auto border-t border-sidebar-border p-2">
        <UserMenu />
      </div>

      <AlertDialog
        open={deleteTargetId !== null}
        onOpenChange={(open) => !open && setDeleteTargetId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the thread and its message history. This
              can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!deleteTargetId) return;
                const wasActive = pathname === `/chat/${deleteTargetId}`;
                deleteConversation(deleteTargetId);
                setDeleteTargetId(null);
                if (wasActive) router.push("/chat");
              }}
            >
              <Check className="size-4" />
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}
