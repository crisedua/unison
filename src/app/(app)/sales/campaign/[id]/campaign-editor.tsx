"use client";

import { Loader2, Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateEmailCampaign } from "@/app/(app)/sales/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { EmailCampaign } from "@/lib/sales/campaign";

type Draft = { title: string; emails: EmailCampaign["emails"] };

/** Edits the campaign template itself; every prospect's version is filled in from it. */
export function CampaignEditor({
  generationId,
  title,
  campaign,
  onDone,
}: {
  generationId: string;
  title: string;
  campaign: EmailCampaign;
  onDone: (saved: boolean) => void;
}) {
  const t = useTranslations("sales");
  const tCommon = useTranslations("common");
  const [draft, setDraft] = useState<Draft>({ title, emails: campaign.emails.map((e) => ({ ...e })) });
  const [pending, startTransition] = useTransition();

  const valid = draft.title.trim() && draft.emails.every((e) => e.subject.trim() && e.body.trim());

  function setEmail(index: number, patch: Partial<Draft["emails"][number]>) {
    setDraft((prev) => ({ ...prev, emails: prev.emails.map((e, i) => (i === index ? { ...e, ...patch } : e)) }));
  }

  function save() {
    startTransition(async () => {
      const result = await updateEmailCampaign(generationId, draft);
      if (!result.ok) {
        toast.error(tCommon("error"));
        return;
      }
      toast.success(t("campaign.edit.saved"));
      onDone(true);
    });
  }

  return (
    <Card className="gap-4 py-5">
      <CardHeader className="gap-1 px-5">
        <CardTitle className="font-bold">{t("campaign.edit.title")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("campaign.edit.help")}</p>
      </CardHeader>
      <CardContent className="space-y-5 px-5">
        <div className="space-y-2">
          <Label htmlFor="campaign-title">{t("campaign.edit.nameLabel")}</Label>
          <Input
            id="campaign-title"
            value={draft.title}
            maxLength={200}
            onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
          />
        </div>

        {draft.emails.map((email, i) => (
          <div key={i} className="space-y-3 rounded-lg border p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-semibold">{t("campaign.edit.emailN", { n: i + 1 })}</p>
              <div className="flex items-center gap-2">
                <Label htmlFor={`email-${i}-day`} className="text-sm font-normal text-muted-foreground">
                  {t("campaign.edit.sendOnDay")}
                </Label>
                <Input
                  id={`email-${i}-day`}
                  type="number"
                  min={0}
                  max={60}
                  value={email.send_on_day}
                  onChange={(e) =>
                    setEmail(i, { send_on_day: Math.max(0, Math.min(60, Math.round(Number(e.target.value) || 0))) })
                  }
                  className="w-20"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`email-${i}-subject`}>{t("campaign.edit.subject")}</Label>
              <Input
                id={`email-${i}-subject`}
                value={email.subject}
                maxLength={300}
                onChange={(e) => setEmail(i, { subject: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`email-${i}-body`}>{t("campaign.edit.body")}</Label>
              <Textarea
                id={`email-${i}-body`}
                value={email.body}
                maxLength={10_000}
                onChange={(e) => setEmail(i, { body: e.target.value })}
                className="min-h-48 leading-relaxed"
              />
            </div>
          </div>
        ))}

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => onDone(false)} disabled={pending}>
            {tCommon("cancel")}
          </Button>
          <Button onClick={save} disabled={pending || !valid}>
            {pending ? <Loader2 className="animate-spin" /> : <Save />}
            {pending ? tCommon("saving") : tCommon("save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
