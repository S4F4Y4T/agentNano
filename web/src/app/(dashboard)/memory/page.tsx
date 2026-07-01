"use client";

import { useEffect, useState } from "react";
import { Brain, Loader2, RefreshCw, Trash2, Plus, Info } from "lucide-react";
import { toast } from "sonner";
import { useAppData } from "@/lib/app-data";
import { formatRelativeTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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
import type { UserMemory } from "@/lib/types";

export default function MemoryPage() {
  const { memories, memoriesLoaded, loadMemories, saveMemory, deleteMemory } = useAppData();
  const [newMemory, setNewMemory] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserMemory | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    document.title = "User Memory — AgentNano";
    loadMemories();
  }, [loadMemories]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemory.trim()) return;
    setSaving(true);
    try {
      await saveMemory(newMemory.trim());
      setNewMemory("");
      toast.success("Memory saved successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save memory");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteMemory(deleteTarget.id);
      toast.success("Memory deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete memory");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
              Persistent Memory
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Facts, project details, and rules AgentNano remembers about you across all conversations.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => loadMemories()} id="refresh-memories-btn">
            <RefreshCw className="size-3.5 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Explain Card */}
        <div className="flex gap-3 rounded-lg border border-violet-100 bg-violet-50/50 p-4 dark:border-violet-950/40 dark:bg-violet-950/10">
          <Info className="size-5 shrink-0 text-violet-600 dark:text-violet-400 mt-0.5" />
          <div className="text-xs text-violet-800 dark:text-violet-300 leading-relaxed">
            <p className="font-medium mb-1">How Agent Memory Works:</p>
            <p className="mb-2">
              The agent dynamically reads these memories at the start of every chat turn. It uses this context to automatically personalize its code and answers to your preferences.
            </p>
            <p>
              You can add memories manually here, or tell the agent directly in chat (e.g., <code className="bg-violet-100 dark:bg-violet-950 px-1 py-0.5 rounded font-mono">"Remember that my server is running Node 22"</code>) and it will save it for you using the <code className="bg-violet-100 dark:bg-violet-950 px-1 py-0.5 rounded font-mono">save_memory</code> tool.
            </p>
          </div>
        </div>

        {/* Add Memory Form */}
        <Card className="border-border/60 shadow-sm bg-card/40 backdrop-blur-sm">
          <form onSubmit={handleSave}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Brain className="size-4 text-violet-500" />
                Add New Memory
              </CardTitle>
              <CardDescription className="text-xs">
                Type a specific detail or instruction you want the agent to remember.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={newMemory}
                onChange={(e) => setNewMemory(e.target.value)}
                placeholder="e.g. 'I prefer Tailwind CSS for styling my Next.js web applications.'"
                className="resize-none min-h-[80px] text-sm"
                required
                id="new-memory-input"
              />
            </CardContent>
            <CardFooter className="flex justify-end pt-0">
              <Button type="submit" size="sm" className="bg-violet-600 hover:bg-violet-700 text-white" disabled={saving || !newMemory.trim()} id="save-memory-btn">
                {saving ? (
                  <>
                    <Loader2 className="size-3.5 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Plus className="size-3.5 mr-2" />
                    Save Memory
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>

        {/* Memories List */}
        <div className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Current Memories ({memories.length})
          </h2>

          {!memoriesLoaded ? (
            <div className="flex justify-center py-12">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : memories.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-12 text-center bg-card/20">
              <Brain className="size-6 text-muted-foreground/60" />
              <p className="text-sm text-muted-foreground">No memories saved yet. Try adding one above.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {memories.map((memory) => (
                <div
                  key={memory.id}
                  className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card p-4 transition-all duration-200 hover:border-violet-500/30 hover:shadow-sm group"
                >
                  <div className="flex min-w-0 gap-3">
                    <div className="mt-0.5 rounded-full bg-violet-100 dark:bg-violet-950/40 p-1.5 shrink-0 text-violet-600 dark:text-violet-400">
                      <Brain className="size-3.5" />
                    </div>
                    <div className="flex flex-col gap-1 min-w-0">
                      <p className="text-sm text-foreground font-medium break-words leading-relaxed whitespace-pre-wrap">
                        {memory.content}
                      </p>
                      <span className="text-[10px] text-muted-foreground">
                        Saved {formatRelativeTime(memory.createdAt)}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Delete memory"
                    onClick={() => setDeleteTarget(memory)}
                    id={`delete-memory-btn-${memory.id}`}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete Dialog */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Forget this memory?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Are you sure you want to delete this memory? The agent will no longer have access to this fact in future turns.
              <span className="block mt-3 bg-muted p-3 rounded text-xs font-mono text-foreground italic border">
                "{deleteTarget?.content}"
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={handleDelete}
              disabled={deleting}
              id="confirm-delete-memory-btn"
            >
              {deleting && <Loader2 className="size-4 animate-spin mr-2" />}
              Forget
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
