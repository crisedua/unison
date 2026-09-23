"use client";

import { ArrowLeft, Copy, Download, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteDraft, updateDraft } from "@/app/(app)/library/actions";
import { downloadText, slugify } from "@/components/content-set/to-markdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { DraftRow } from "@/lib/types";

export function DraftEditor({ draft }: { draft: DraftRow }) {
  const t = useTranslations("drafts");
  const tCommon = useTranslations("common");
  const tLibrary = useTranslations("library");
  const format = useFormatter();
  const router = useRouter();

  const [title, setTitle] = useState(draft.title);
  const [body, setBody] = useState(draft.body);
  const [saved, setSaved] = useState({ title: draft.title, body: draft.body, at: draft.updated_at });
  const [pending, startTransition] = useTransition();
  const dirty = title !== saved.title || body !== saved.body;

  function save() {
    if (!dirty || pending || !title.trim()) return;
    startTransition(async () => {
      const result = await updateDraft(draft.id, { title, body });
      if (!result.ok) {
        toast.error(tCommon("error"));
        return;
      }
      setSaved({ title, body, at: new Date().toISOString() });
      toast.success(t("saved"));
    });
  }

  function remove() {
    if (!window.confirm(t("confirmDelete"))) return;
    startTransition(async () => {
      const result = await deleteDraft(draft.id);
      if (!result.ok) {
        toast.error(tCommon("error"));
        return;
      }
      toast.success(t("deleted"));
      router.push("/library?tab=drafts");
    });
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(body);
      toast.success(tCommon("copied"));
    } catch {
      toast.error(tCommon("error"));
    }
  }

  // Cmd/Ctrl+S saves; warn before leaving with unsaved changes.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        save();
      }
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/library?tab=drafts"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {tLibrary("backToLibrary")}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={copy}>
            <Copy />
            {tCommon("copy")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => downloadText(`${slugify(title)}.md`, body)}>
            <Download />
            {tCommon("download")}
          </Button>
          <Button variant="ghost" size="sm" onClick={remove} disabled={pending} className="text-muted-foreground">
            <Trash2 />
            {t("delete")}
          </Button>
          <Button size="sm" onClick={save} disabled={!dirty || pending || !title.trim()}>
            <Save />
            {pending ? tCommon("saving") : tCommon("save")}
          </Button>
        </div>
      </div>

      <Card className="py-6">
        <CardContent className="space-y-5 px-6">
          <div className="space-y-2">
            <Label htmlFor="draft-title">{t("titleLabel")}</Label>
            <Input
              id="draft-title"
              value={title}
              maxLength={300}
              onChange={(e) => setTitle(e.target.value)}
              className="h-11 font-heading text-lg font-bold"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="draft-body">{t("bodyLabel")}</Label>
            <Textarea
              id="draft-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="min-h-[55vh] bg-card text-[15px] leading-relaxed"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{t("updated", { date: format.dateTime(new Date(saved.at), { dateStyle: "medium", timeStyle: "short" }) })}</span>
            {draft.generation_id && (
              <Link href={`/library/${draft.generation_id}`} className="underline underline-offset-2 hover:text-foreground">
                {t("fromSet")}
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
