import { Megaphone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { StatusBadge } from "@/components/campaigns/status-badge";
import { Verdict } from "@/components/campaigns/verdict";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { listCampaigns } from "@/lib/campaigns/queries";
import { hasResults, parseMetrics } from "@/lib/campaigns/schema";
import { compareVariants } from "@/lib/campaigns/stats";
import { getReadyContext } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { LogCampaignDialog } from "./log-campaign-dialog";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("results");
  return { title: t("title") };
}

export default async function ResultsPage() {
  const ctx = await getReadyContext();
  if (!ctx) return null;
  if (!ctx.activeBrand) redirect("/brain");

  const supabase = await createClient();
  const campaigns = await listCampaigns(supabase, ctx.activeBrand.id);

  const t = await getTranslations("results");
  const tCampaigns = await getTranslations("campaigns");
  const format = await getFormatter();

  return (
    <div>
      <PageHeader title={t("title")} description={t("subtitle")}>
        <LogCampaignDialog />
        <Button asChild>
          <Link href="/campaigns/new">
            <Megaphone />
            {tCampaigns("newCampaign")}
          </Link>
        </Button>
      </PageHeader>

      {campaigns.length === 0 ? (
        <p className="rounded-xl border border-dashed px-6 py-14 text-center text-sm text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
          {campaigns.map((campaign) => {
            const metrics = parseMetrics(campaign.metrics);
            const started = hasResults(metrics);
            return (
              <li key={campaign.id}>
                <Link
                  href={`/campaigns/${campaign.id}#results`}
                  className="grid grid-cols-1 gap-2 px-4 py-3.5 transition-colors hover:bg-muted/60 sm:grid-cols-[minmax(0,1fr)_16rem] sm:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{campaign.name}</span>
                      <StatusBadge status={campaign.status} label={tCampaigns(`statuses.${campaign.status}`)} />
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t("updated", {
                        date: format.dateTime(new Date(campaign.updated_at), { dateStyle: "medium" }),
                      })}
                      {started &&
                        ` · A ${format.number(metrics.a.reached)} / B ${format.number(metrics.b.reached)} ${t("reached").toLowerCase()}`}
                    </p>
                  </div>
                  {started ? (
                    <Verdict comparison={compareVariants(metrics.a, metrics.b)} compact />
                  ) : (
                    <span className="text-sm text-muted-foreground">{t("noNumbers")}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
