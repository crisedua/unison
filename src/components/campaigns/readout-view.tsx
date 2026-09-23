"use client";

import { Brain, Lightbulb } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveLearningToBrain } from "@/app/(app)/campaigns/actions";
import { FactsUsed } from "@/components/content-set/facts-used";
import { Button } from "@/components/ui/button";
import type { Readout } from "@/lib/campaigns/schema";

export function ReadoutView({ readout, generationId }: { readout: Readout; generationId: string | null }) {
  const t = useTranslations("results");
  const tBrief = useTranslations("campaigns.brief");
  const tCampaigns = useTranslations("campaigns");
  const tCommon = useTranslations("common");
  const [saved, setSaved] = useState(false);
  const [saving, startSaving] = useTransition();
  const next = readout.next_test;

  function saveLearning() {
    if (!generationId) return;
    startSaving(async () => {
      const result = await saveLearningToBrain(generationId);
      if (!result.ok) {
        toast.error(tCommon("error"));
        return;
      }
      setSaved(true);
      toast.success(t("learningSaved"));
    });
  }

  return (
    <div className="space-y-5">
      <h3 className="font-heading text-lg font-bold">{readout.headline}</h3>

      <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
        <Section title={t("whatHappened")}>{readout.what_happened}</Section>
        <Section title={t("why")}>{readout.why}</Section>
      </div>

      <div className="space-y-3 rounded-lg border p-4 text-sm">
        <p className="text-xs font-semibold tracking-wide text-primary uppercase">{t("nextTest")}</p>
        <p>{next.hypothesis}</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <p className="rounded-md bg-muted p-2.5">
            <span className="font-semibold">{tBrief("variant", { name: "A" })}:</span> {next.variant_a}
          </p>
          <p className="rounded-md bg-muted p-2.5">
            <span className="font-semibold">{tBrief("variant", { name: "B" })}:</span> {next.variant_b}
          </p>
        </div>
        <p className="text-muted-foreground">
          {tBrief("metric")}: {next.metric} · {tBrief("testLength")}:{" "}
          {tCampaigns("durationDays", { days: next.duration_days })}
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-lg bg-accent/70 p-4 text-sm sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-2.5">
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-accent-foreground" />
          <div>
            <p className="text-xs font-semibold tracking-wide text-accent-foreground uppercase">{t("learning")}</p>
            <p className="mt-0.5">{readout.learning}</p>
          </div>
        </div>
        {generationId && (
          <Button size="sm" variant="outline" className="shrink-0" onClick={saveLearning} disabled={saving || saved}>
            <Brain />
            {t("saveLearning")}
          </Button>
        )}
      </div>

      {readout.caveats.length > 0 && (
        <div className="text-sm">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t("caveats")}</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {readout.caveats.map((caveat, i) => (
              <li key={i}>{caveat}</li>
            ))}
          </ul>
        </div>
      )}

      <FactsUsed facts={readout.facts_used} />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</p>
      <p className="mt-0.5 leading-relaxed">{children}</p>
    </div>
  );
}
