"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock, Loader2, RefreshCw, Repeat, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAppData } from "@/lib/app-data";
import { formatTimeUntil } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import type { ScheduledTask } from "@/lib/types";

export default function ScheduledTasksPage() {
  const { scheduledTasks, scheduledTasksLoaded, loadScheduledTasks, cancelScheduledTask } =
    useAppData();
  const [cancelTarget, setCancelTarget] = useState<ScheduledTask | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    document.title = "Scheduled tasks — AgentNano";
    loadScheduledTasks();
  }, [loadScheduledTasks]);

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await cancelScheduledTask(cancelTarget.id, cancelTarget.type);
      toast.success("Scheduled task cancelled");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't cancel task");
    } finally {
      setCancelling(false);
      setCancelTarget(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-xl font-bold">Scheduled tasks</h1>
            <p className="text-sm text-muted-foreground">
              Commands AgentNano has scheduled to run in the background.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => loadScheduledTasks()}>
            <RefreshCw className="size-3.5" />
            Refresh
          </Button>
        </div>

        {!scheduledTasksLoaded ? (
          <div className="flex justify-center py-12">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : scheduledTasks.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-12 text-center">
            <Clock className="size-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No scheduled tasks right now.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {scheduledTasks.map((task) => (
              <div
                key={`${task.type}-${task.id}`}
                className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card p-4"
              >
                <div className="flex min-w-0 flex-col gap-1.5">
                  <code className="truncate text-sm font-medium">{task.command}</code>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="h-5 gap-1 px-1.5 font-normal">
                      {task.type === "cron" ? (
                        <>
                          <Repeat className="size-3" />
                          {task.cron}
                        </>
                      ) : (
                        "One-off"
                      )}
                    </Badge>
                    {task.nextRunAt && <span>Next run {formatTimeUntil(task.nextRunAt)}</span>}
                    <span>·</span>
                    <Link href={`/chat/${task.conversationId}`} className="truncate hover:underline">
                      {task.conversationTitle}
                    </Link>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label="Cancel scheduled task"
                  onClick={() => setCancelTarget(task)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog
        open={cancelTarget !== null}
        onOpenChange={(open) => !open && setCancelTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this scheduled task?</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelTarget?.type === "cron"
                ? "This stops the recurring command from running again."
                : "This stops the command from running."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} disabled={cancelling}>
              {cancelling && <Loader2 className="size-4 animate-spin" />}
              Cancel task
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
