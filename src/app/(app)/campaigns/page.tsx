import { ChartLine, Megaphone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { StatusBadge } from "@/components/campaigns/status-badge";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { listCampaigns } from "@/lib/campaigns/queries";
import { hasResults, parseMetrics } from "@/lib/campaigns/schema";
import { getReadyContext } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("campaigns");
  return { title: t("title") };
}

export default async function CampaignsPage() {
  const ctx = await getReadyContext();
  if (!ctx) return null;
  if (!ctx.activeBrand) redirect("/brain");

  const supabase = await createClient();
  const campaigns = await listCampaigns(supabase, ctx.activeBrand.id);

  const t = await getTranslations("campaigns");
  const tResults = await getTranslations("results");
  const format = await getFormatter();

  return (
    <div>
      <PageHeader title={t("title")} description={t("subtitle")}>
        <Button asChild>
          <Link href="/campaigns/new">
            <Megaphone />
            {t("newCampaign")}
          </Link>
        </Button>
      </PageHeader>

      {campaigns.length === 0 ? (
        <p className="rounded-xl border border-dashed px-6 py-14 text-center text-sm text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {campaigns.map((campaign) => (
            <li key={campaign.id}>
              <Link
                href={`/campaigns/${campaign.id}`}
                className="flex h-full flex-col gap-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition-shadow hover:shadow-md hover:ring-primary/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-heading font-bold">{campaign.name}</p>
                  <StatusBadge status={campaign.status} label={t(`statuses.${campaign.status}`)} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {t(`goals.${campaign.goal}`)} ·{" "}
                  {t("createdOn", { date: format.dateTime(new Date(campaign.created_at), { dateStyle: "medium" }) })}
                </p>
                {hasResults(parseMetrics(campaign.metrics)) && (
                  <p className="mt-auto flex items-center gap-1.5 pt-1 text-xs font-medium text-primary">
                    <ChartLine className="size-3.5" />
                    {tResults("title")}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
