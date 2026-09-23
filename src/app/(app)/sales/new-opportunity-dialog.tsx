"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { OPPORTUNITY_STAGES } from "@/lib/sales/schema";
import { createOpportunity, type CreateOpportunityState } from "./actions";

export function NewOpportunityDialog() {
  const t = useTranslations("sales");
  const [state, formAction, pending] = useActionState<CreateOpportunityState, FormData>(createOpportunity, {});

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          {t("newOpportunity")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("newOpportunity")}</DialogTitle>
          <DialogDescription>{t("notesHelp")}</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="opp-company">{t("companyLabel")}</Label>
            <Input
              id="opp-company"
              name="company_name"
              required
              maxLength={200}
              placeholder={t("companyPlaceholder")}
              aria-invalid={state.error === "company" || undefined}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="opp-contact">{t("contactLabel")}</Label>
              <Input id="opp-contact" name="contact_name" maxLength={200} placeholder={t("contactPlaceholder")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="opp-role">{t("roleLabel")}</Label>
              <Input id="opp-role" name="contact_role" maxLength={200} placeholder={t("rolePlaceholder")} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="opp-stage">{t("stageLabel")}</Label>
            <Select name="stage" defaultValue="new">
              <SelectTrigger id="opp-stage" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPPORTUNITY_STAGES.map((stage) => (
                  <SelectItem key={stage} value={stage}>
                    {t(`stages.${stage}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="opp-note">{t("firstNoteLabel")}</Label>
            <Textarea
              id="opp-note"
              name="note"
              maxLength={20000}
              placeholder={t("firstNotePlaceholder")}
              className="min-h-24"
            />
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
