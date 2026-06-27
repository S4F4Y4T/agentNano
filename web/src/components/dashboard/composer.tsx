"use client";

import { useRef, useState } from "react";
import { ArrowUp, Loader2, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { useAppData } from "@/lib/app-data";
import { genId } from "@/lib/id";
import { formatBytes } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Attachment } from "@/lib/types";

type PendingAttachment = Attachment & { uploading?: boolean };

export function Composer({
  conversationId,
  agentName,
}: {
  conversationId: string;
  agentName: string;
}) {
  const { sendMessage, uploadAttachment } = useAppData();
  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [isSending, setIsSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isUploading = attachments.some((a) => a.uploading);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      const tempId = genId("att");
      setAttachments((prev) => [
        ...prev,
        {
          id: tempId,
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          uploading: true,
        },
      ]);
      uploadAttachment(conversationId, file)
        .then((attachment) => {
          setAttachments((prev) =>
            prev.map((a) => (a.id === tempId ? { ...attachment, uploading: false } : a))
          );
        })
        .catch((err) => {
          toast.error(err instanceof Error ? err.message : "Upload failed");
          setAttachments((prev) => prev.filter((a) => a.id !== tempId));
        });
    }
  };

  const handleSend = async () => {
    if (isSending || isUploading || (!value.trim() && attachments.length === 0)) return;
    const content = value.trim();
    const messageAttachments = attachments;
    setValue("");
    setAttachments([]);
    setIsSending(true);
    try {
      await sendMessage(conversationId, content, messageAttachments);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send message");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div>
      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {attachments.map((a) => (
            <span
              key={a.id}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-2 py-1 text-xs"
            >
              {a.uploading ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Paperclip className="size-3" />
              )}
              {a.filename}
              <span className="text-muted-foreground">{formatBytes(a.sizeBytes)}</span>
              <button
                type="button"
                onClick={() =>
                  setAttachments((prev) => prev.filter((x) => x.id !== a.id))
                }
                aria-label={`Remove ${a.filename}`}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-end gap-1.5 rounded-lg border border-input bg-card p-1.5">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Attach files"
        >
          <Paperclip className="size-4" />
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={`Message ${agentName}…`}
          rows={1}
          className="max-h-40 min-h-9 flex-1 resize-none border-0 bg-transparent p-1.5 shadow-none focus-visible:ring-0"
        />
        <Button
          type="button"
          size="icon-sm"
          onClick={handleSend}
          disabled={isSending || isUploading || (!value.trim() && attachments.length === 0)}
          aria-label="Send message"
        >
          {isSending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ArrowUp className="size-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
