"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteGeneration } from "../actions";

export function DeleteSetButton({ id }: { id: string }) {
  const t = useTranslations("library");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function remove() {
    if (!window.confirm(t("confirmDelete"))) return;
    startTransition(async () => {
      const result = await deleteGeneration(id);
      if (!result.ok) {
        toast.error(tCommon("error"));
        return;
      }
      toast.success(t("deleted"));
      router.push("/library");
    });
  }

  return (
    <Button variant="ghost" size="sm" onClick={remove} disabled={pending} className="text-muted-foreground">
      <Trash2 />
      {t("deleteSet")}
    </Button>
  );
}
