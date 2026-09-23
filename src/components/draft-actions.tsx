"use client";

import { Copy, NotebookPen } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { saveDraft } from "@/app/(app)/studio/actions";
import { Button } from "@/components/ui/button";

export function CopyButton({ text, label }: { text: string | (() => string); label?: string }) {
  const tCommon = useTranslations("common");

  async function copy() {
    try {
      await navigator.clipboard.writeText(typeof text === "function" ? text() : text);
      toast.success(tCommon("copied"));
    } catch {
      toast.error(tCommon("error"));
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={copy}>
      <Copy />
      {label ?? tCommon("copy")}
    </Button>
  );
}

/** Saves a piece as an editable draft, with a toast that opens it. */
export function SaveDraftButton({
  generationId,
  assetType,
  title,
  body,
  variant = "default",
}: {
  generationId: string | null;
  assetType: string;
  title: string;
  body: string | (() => string);
  variant?: "default" | "outline";
}) {
  const t = useTranslations("result");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [saving, startSaving] = useTransition();

  function save() {
    startSaving(async () => {
      const result = await saveDraft({
        generationId,
        assetType,
        title,
        body: typeof body === "function" ? body() : body,
      });
      if (!result.ok) {
        toast.error(tCommon("error"));
        return;
      }
      toast.success(t("draftSaved"), {
        action: { label: t("openDraft"), onClick: () => router.push(`/drafts/${result.id}`) },
      });
    });
  }

  return (
    <Button size="sm" variant={variant} onClick={save} disabled={saving}>
      <NotebookPen />
      {saving ? t("savingDraft") : t("saveDraft")}
    </Button>
  );
}
