"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CAMPAIGN_STATUSES, type CampaignStatus } from "@/lib/campaigns/schema";
import { deleteCampaign, updateCampaign } from "../actions";

export function CampaignControls({ id, status }: { id: string; status: CampaignStatus }) {
  const t = useTranslations("campaigns");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function changeStatus(value: string) {
    const next = CAMPAIGN_STATUSES.find((s) => s === value);
    if (!next || next === status) return;
    startTransition(async () => {
      const result = await updateCampaign(id, { status: next });
      if (!result.ok) toast.error(tCommon("error"));
    });
  }

  function remove() {
    if (!window.confirm(t("confirmDelete"))) return;
    startTransition(async () => {
      const result = await deleteCampaign(id);
      if (!result.ok) {
        toast.error(tCommon("error"));
        return;
      }
      toast.success(t("deleted"));
      router.push("/campaigns");
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={status} onValueChange={changeStatus} disabled={pending}>
        <SelectTrigger size="sm" className="w-32" aria-label={t("statusLabel")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CAMPAIGN_STATUSES.map((option: CampaignStatus) => (
            <SelectItem key={option} value={option}>
              {t(`statuses.${option}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button variant="ghost" size="sm" onClick={remove} disabled={pending} className="text-muted-foreground">
        <Trash2 />
        {t("deleteCampaign")}
      </Button>
    </div>
  );
}
