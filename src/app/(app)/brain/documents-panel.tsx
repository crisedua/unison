"use client";

import { Circle, CircleCheck, FileText, Plus, StickyNote, Trash2, Upload } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { BrandDocument } from "@/lib/types";
import { addNote, deleteDocument, uploadDocument, type DocumentResult } from "./actions";

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const ACCEPT = ".pdf,.docx,.txt,.md,.markdown";

export function DocumentsPanel({
  brandId,
  documents,
  filled,
}: {
  brandId: string;
  documents: BrandDocument[];
  filled: boolean;
}) {
  const t = useTranslations("documents");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [uploading, startUpload] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function reportFailure(result: Extract<DocumentResult, { ok: false }>) {
    toast.error(t(`errors.${result.error}`));
  }

  function onFileChosen(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error(t("errors.too_large"));
      return;
    }
    const data = new FormData();
    data.set("file", file);
    startUpload(async () => {
      const result = await uploadDocument(brandId, data);
      if (!result.ok) return reportFailure(result);
      toast.success(t("fileSaved", { name: result.name }));
      if (result.truncated) toast.info(t("truncated"));
    });
  }

  async function remove(doc: BrandDocument) {
    if (!window.confirm(t("confirmDelete", { title: doc.title }))) return;
    setDeletingId(doc.id);
    const result = await deleteDocument(doc.id);
    setDeletingId(null);
    if (result.ok) toast.success(t("deleted"));
    else toast.error(tCommon("error"));
  }

  return (
    <Card id="notes" className="scroll-mt-24 gap-4 py-5">
      <CardHeader className="px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 font-bold">
            {filled ? (
              <CircleCheck className="size-4 text-success" aria-hidden />
            ) : (
              <Circle className="size-4 text-muted-foreground/50" aria-hidden />
            )}
            {t("title")}
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setNoteOpen(true)}>
              <Plus />
              {t("addNote")}
            </Button>
            <Button variant="outline" size="sm" disabled={uploading} onClick={() => fileInput.current?.click()}>
              <Upload />
              {uploading ? t("uploading") : t("upload")}
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                onFileChosen(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
        </div>
        <CardDescription>{t("help")}</CardDescription>
      </CardHeader>
      <CardContent className="px-5">
        {documents.length === 0 ? (
          <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
            {t("empty")}
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {documents.map((doc) => {
              const Icon = doc.kind === "note" ? StickyNote : FileText;
              return (
                <li key={doc.id} className="flex items-center gap-3 px-3 py-2.5">
                  <Icon className="size-4 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{doc.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {doc.kind === "note" ? t("note") : (doc.file_name ?? t("file"))} ·{" "}
                      {t("characters", { count: doc.content.length })} ·{" "}
                      {format.dateTime(new Date(doc.created_at), { dateStyle: "medium" })}
                    </p>
                  </div>
                  {doc.truncated && (
                    <Badge variant="outline" title={t("truncated")}>
                      100k
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={tCommon("delete")}
                    disabled={deletingId === doc.id}
                    onClick={() => remove(doc)}
                  >
                    <Trash2 />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>

      <NoteDialog brandId={brandId} open={noteOpen} onOpenChange={setNoteOpen} />
    </Card>
  );
}

function NoteDialog({
  brandId,
  open,
  onOpenChange,
}: {
  brandId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("documents");
  const tCommon = useTranslations("common");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await addNote(brandId, { title, content });
      if (!result.ok) {
        toast.error(t(`errors.${result.error}`));
        return;
      }
      toast.success(t("noteSaved"));
      setTitle("");
      setContent("");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t("noteDialogTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="note-title">{t("noteTitleLabel")}</Label>
            <Input
              id="note-title"
              value={title}
              required
              maxLength={200}
              placeholder={t("noteTitlePlaceholder")}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="note-content">{t("noteContentLabel")}</Label>
            <Textarea
              id="note-content"
              value={content}
              required
              placeholder={t("noteContentPlaceholder")}
              onChange={(e) => setContent(e.target.value)}
              className="max-h-[50vh] min-h-40"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={pending || !title.trim() || !content.trim()}>
              {pending ? tCommon("saving") : t("saveNote")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
