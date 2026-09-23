import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { z } from "zod";
import { CampaignBriefView } from "@/components/campaigns/campaign-brief-view";
import { ResultsPanel, type StoredReadout } from "@/components/campaigns/results-panel";
import { Card, CardContent } from "@/components/ui/card";
import { loadCampaign, loadCampaignGenerations } from "@/lib/campaigns/queries";
import { parseMetrics, parseStoredBrief, parseStoredReadout } from "@/lib/campaigns/schema";
import { getReadyContext } from "@/lib/context";
import { DEFAULT_CONTENT_LANGUAGE, isContentLanguage } from "@/lib/languages";
import { createClient } from "@/lib/supabase/server";
import { CampaignControls } from "./campaign-controls";

// Writing a read-out can take a minute; allow Server Actions on this page up to 5.
export const maxDuration = 300;

async function load(id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const supabase = await createClient();
  return loadCampaign(supabase, id);
}

export async function generateMetadata({ params }: PageProps<"/campaigns/[id]">): Promise<Metadata> {
  const campaign = await load((await params).id);
  return { title: campaign?.name };
}

export default async function CampaignPage({ params }: PageProps<"/campaigns/[id]">) {
  const ctx = await getReadyContext();
  if (!ctx) return null;

  const campaign = await load((await params).id);
  if (!campaign) notFound();

  const supabase = await createClient();
  const history = await loadCampaignGenerations(supabase, campaign.id);
  const briefRow = history.find((g) => g.studio === "campaign");
  const brief = briefRow ? parseStoredBrief(briefRow.output) : null;
  const readouts: StoredReadout[] = history.flatMap((g) => {
    const readout = g.studio === "results" ? parseStoredReadout(g.output) : null;
    return readout ? [{ id: g.id, readout, createdAt: g.created_at }] : [];
  });

  const brandLanguage = ctx.brands.find((b) => b.id === campaign.brand_id)?.content_language;
  const language = isContentLanguage(briefRow?.language)
    ? briefRow.language
    : (brandLanguage ?? DEFAULT_CONTENT_LANGUAGE);

  const t = await getTranslations("campaigns");
  const format = await getFormatter();

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/campaigns"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            {t("backToCampaigns")}
          </Link>
          <CampaignControls key={campaign.status} id={campaign.id} status={campaign.status} />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-3xl font-extrabold sm:text-4xl">{campaign.name}</h1>
          <p className="text-sm text-muted-foreground">
            {t(`goals.${campaign.goal}`)} ·{" "}
            {t("createdOn", { date: format.dateTime(new Date(campaign.created_at), { dateStyle: "medium" }) })}
          </p>
        </div>
      </div>

      {brief && briefRow ? (
        <CampaignBriefView brief={brief} generationId={briefRow.id} />
      ) : (
        <Card className="py-4">
          <CardContent className="px-5 text-sm text-muted-foreground">{t("noBrief")}</CardContent>
        </Card>
      )}

      <ResultsPanel
        key={campaign.id}
        campaignId={campaign.id}
        initial={{
          conversionLabel: campaign.conversion_label,
          variantA: campaign.variant_a,
          variantB: campaign.variant_b,
          metrics: parseMetrics(campaign.metrics),
        }}
        readouts={readouts}
        defaultLanguage={language}
      />
    </div>
  );
}
