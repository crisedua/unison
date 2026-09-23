"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { createResultsCampaign, type ManualCampaignState } from "@/app/(app)/campaigns/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LogCampaignDialog() {
  const t = useTranslations("results");
  const [state, formAction, pending] = useActionState<ManualCampaignState, FormData>(createResultsCampaign, {});

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus />
          {t("logOther")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("logOtherTitle")}</DialogTitle>
          <DialogDescription>{t("logOtherBody")}</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="log-name">{t("nameLabel")}</Label>
            <Input
              id="log-name"
              name="name"
              required
              maxLength={200}
              placeholder={t("namePlaceholder")}
              aria-invalid={state.error === "name" || undefined}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="log-a">{t("variantALabel")}</Label>
            <Input id="log-a" name="variant_a" maxLength={500} placeholder={t("variantPlaceholder")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="log-b">{t("variantBLabel")}</Label>
            <Input id="log-b" name="variant_b" maxLength={500} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="log-conversion">{t("conversionLabel")}</Label>
            <Input id="log-conversion" name="conversion_label" maxLength={120} placeholder={t("conversionPlaceholder")} />
          </div>
          {state.error && (
            <p className="text-sm text-destructive" role="alert">
              {t(`errors.${state.error}`)}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? t("creating") : t("create")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
