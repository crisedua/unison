"use client";

import { Loader2, Mails } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { ActionError, AiMissingAlert, MissingFactsNotice } from "@/components/action-error";
import { FindLeads } from "@/components/sales/find-leads";
import { StageBadge } from "@/components/sales/stage-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { missingFacts, type FactKey } from "@/lib/brain/facts";
import { CONTENT_LANGUAGES, isContentLanguage, type ContentLanguage } from "@/lib/languages";
import type { Credits } from "@/lib/leads/explorium";
import { campaignRequirements, MAX_CAMPAIGN_PROSPECTS } from "@/lib/sales/campaign";
import type { Opportunity } from "@/lib/types";
import { writeEmailCampaign, type CampaignResult } from "./actions";
import { NewOpportunityDialog } from "./new-opportunity-dialog";

type Props = {
  opportunities: Opportunity[];
  leadsConfigured: boolean;
  credits: Credits | null;
  status: Record<FactKey, boolean>;
  defaultLanguage: ContentLanguage;
  aiConfigured: boolean;
};

export function SalesWorkspace({ opportunities, leadsConfigured, credits, status, defaultLanguage, aiConfigured }: Props) {
  const t = useTranslations("sales");
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);

  const ids = new Set(opportunities.map((o) => o.id));
  const selectedIds = [...selected].filter((id) => ids.has(id));
  const allSelected = opportunities.length > 0 && selectedIds.length === opportunities.length;

  function toggleOne(id: string, on: boolean) {
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    setSelected(next);
  }

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <StepHeading step={1} title={t("campaign.stepFind")} help={t("campaign.stepFindHelp")} />
        <FindLeads
          configured={leadsConfigured}
          credits={credits}
          onAdded={(newIds) => {
            setSelected(new Set(newIds));
            router.refresh();
            document.getElementById("prospects")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />
      </section>

      <section id="prospects" className="scroll-mt-6 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <StepHeading step={2} title={t("campaign.stepProspects")} help={t("campaign.stepProspectsHelp")} />
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <NewOpportunityDialog />
            <Button onClick={() => setDialogOpen(true)} disabled={selectedIds.length === 0}>
              <Mails />
              {selectedIds.length > 0
                ? t("campaign.writeFor", { count: selectedIds.length })
                : t("campaign.write")}
            </Button>
          </div>
        </div>

        {opportunities.length === 0 ? (
          <p className="rounded-xl border border-dashed px-6 py-14 text-center text-sm text-muted-foreground">
            {t("empty")}
          </p>
        ) : (
          <div className="space-y-2">
            <label className="flex items-center gap-2 px-1 text-sm text-muted-foreground">
              <Checkbox
                checked={allSelected}
                onCheckedChange={(on) =>
                  setSelected(on === true ? new Set(opportunities.slice(0, MAX_CAMPAIGN_PROSPECTS).map((o) => o.id)) : new Set())
                }
              />
              {selectedIds.length > 0 ? t("campaign.selected", { count: selectedIds.length }) : t("campaign.selectHint")}
            </label>
            <ul className="divide-y overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
              {opportunities.map((opportunity) => (
                <OpportunityRow
                  key={opportunity.id}
                  opportunity={opportunity}
                  checked={selected.has(opportunity.id)}
                  onCheckedChange={(on) => toggleOne(opportunity.id, on)}
                />
              ))}
            </ul>
          </div>
        )}
      </section>

      <CampaignDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        opportunityIds={selectedIds}
        status={status}
        defaultLanguage={defaultLanguage}
        aiConfigured={aiConfigured}
      />
    </div>
  );
}

function StepHeading({ step, title, help }: { step: number; title: string; help: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
        {step}
      </span>
      <div>
        <h2 className="text-xl font-bold">{title}</h2>
        <p className="text-sm text-muted-foreground">{help}</p>
      </div>
    </div>
  );
}

function OpportunityRow({
  opportunity,
  checked,
  onCheckedChange,
}: {
  opportunity: Opportunity;
  checked: boolean;
  onCheckedChange: (on: boolean) => void;
}) {
  const t = useTranslations("sales");
  const format = useFormatter();
  const contact = [opportunity.contact_name, opportunity.contact_role].filter((v) => v.trim()).join(", ");

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <Checkbox checked={checked} onCheckedChange={(on) => onCheckedChange(on === true)} />
      <Link href={`/sales/${opportunity.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-md">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium hover:underline">{opportunity.company_name}</p>
          {contact && <p className="truncate text-xs text-muted-foreground">{contact}</p>}
        </div>
        <span className="hidden text-xs text-muted-foreground sm:inline">
          {t("updated", { date: format.dateTime(new Date(opportunity.updated_at), { dateStyle: "medium" }) })}
        </span>
        <StageBadge stage={opportunity.stage} label={t(`stages.${opportunity.stage}`)} />
      </Link>
    </li>
  );
}

function CampaignDialog({
  open,
  onOpenChange,
  opportunityIds,
  status,
  defaultLanguage,
  aiConfigured,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunityIds: string[];
  status: Record<FactKey, boolean>;
  defaultLanguage: ContentLanguage;
  aiConfigured: boolean;
}) {
  const t = useTranslations("sales");
  const tCommon = useTranslations("common");
  const tLanguages = useTranslations("languages");
  const router = useRouter();
  const [language, setLanguage] = useState<ContentLanguage>(defaultLanguage);
  const [focus, setFocus] = useState("");
  const [error, setError] = useState<Extract<CampaignResult, { ok: false }>["error"] | null>(null);
  const [pending, startTransition] = useTransition();

  const missing = missingFacts(status, campaignRequirements);
  const canWrite = aiConfigured && missing.length === 0 && opportunityIds.length > 0 && !pending;

  function write() {
    startTransition(async () => {
      setError(null);
      try {
        const result = await writeEmailCampaign({ opportunityIds, language, focus });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        onOpenChange(false);
        router.push(`/sales/campaign/${result.generationId}`);
      } catch {
        setError({ code: "ai_failed" });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("campaign.dialogTitle")}</DialogTitle>
          <DialogDescription>{t("campaign.dialogBody", { count: opportunityIds.length })}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {!aiConfigured && <AiMissingAlert />}
          {missing.length > 0 && <MissingFactsNotice missing={missing} />}
          <div className="space-y-2">
            <Label htmlFor="campaign-language">{t("languageLabel")}</Label>
            <Select value={language} onValueChange={(v) => isContentLanguage(v) && setLanguage(v)}>
              <SelectTrigger id="campaign-language" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTENT_LANGUAGES.map((code) => (
                  <SelectItem key={code} value={code}>
                    {tLanguages(code)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="campaign-focus">{t("campaign.focusLabel")}</Label>
            <Textarea
              id="campaign-focus"
              value={focus}
              maxLength={500}
              placeholder={t("campaign.focusPlaceholder")}
              onChange={(e) => setFocus(e.target.value)}
              className="min-h-20"
            />
          </div>
          {error && <ActionError error={error} />}
          {pending && <p className="text-sm text-muted-foreground">{t("generatingHint")}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            {tCommon("cancel")}
          </Button>
          <Button type="button" onClick={write} disabled={!canWrite}>
            {pending ? <Loader2 className="animate-spin" /> : <Mails />}
            {pending ? t("campaign.writing") : t("campaign.write")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
