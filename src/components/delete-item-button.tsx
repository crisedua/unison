"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { deleteDraft, deleteGeneration } from "@/app/(app)/library/actions";
import { cn } from "@/lib/utils";

/** Trash button for a row in a list: asks first, deletes, then refreshes the list in place. */
export function DeleteItemButton({
  kind,
  id,
  title,
  className,
}: {
  kind: "generation" | "draft";
  id: string;
  title: string;
  className?: string;
}) {
  const t = useTranslations("library");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function remove() {
    if (!window.confirm(t(kind === "draft" ? "confirmDeleteDraft" : "confirmDeleteItem", { title }))) return;
    startTransition(async () => {
      const result = kind === "draft" ? await deleteDraft(id) : await deleteGeneration(id);
      if (!result.ok) {
        toast.error(tCommon("error"));
        return;
      }
      toast.success(t(kind === "draft" ? "draftDeleted" : "deleted"));
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={pending}
      aria-label={`${tCommon("delete")}: ${title}`}
      title={tCommon("delete")}
      className={cn(
        "rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50",
        className,
      )}
    >
      <Trash2 className="size-4" />
    </button>
  );
}
