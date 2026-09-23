"use client";

import { PenLine } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { CHANNEL_ICONS } from "@/components/campaigns/channel-icons";
import { FactsUsed } from "@/components/content-set/facts-used";
import { CopyButton, SaveDraftButton } from "@/components/draft-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CampaignBrief } from "@/lib/campaigns/schema";

const TABS = ["overview", "angles", "abTest", "launchPlan", "assets"] as const;

export function CampaignBriefView({ brief, generationId }: { brief: CampaignBrief; generationId: string }) {
  const t = useTranslations("campaigns.brief");

  return (
    <Tabs defaultValue="overview" className="gap-3">
      <TabsList className="w-full flex-wrap justify-start gap-1 bg-transparent p-0 group-data-horizontal/tabs:h-auto">
        {TABS.map((tab) => (
          <TabsTrigger
            key={tab}
            value={tab}
            className="h-8 flex-none rounded-lg border-border bg-card px-3 data-active:border-primary data-active:bg-primary data-active:text-primary-foreground"
          >
            {t(tab)}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="overview">
        <Overview brief={brief} />
      </TabsContent>
      <TabsContent value="angles">
        <Angles brief={brief} />
      </TabsContent>
      <TabsContent value="abTest">
        <AbTest brief={brief} />
      </TabsContent>
      <TabsContent value="launchPlan">
        <LaunchPlan brief={brief} />
      </TabsContent>
      <TabsContent value="assets">
        <ChannelAssets brief={brief} generationId={generationId} />
      </TabsContent>
    </Tabs>
  );
}

function Overview({ brief }: { brief: CampaignBrief }) {
  const t = useTranslations("campaigns.brief");
  return (
    <Card className="gap-5 py-5">
      <CardContent className="space-y-5 px-5">
        <p className="text-[15px] leading-relaxed">{brief.summary}</p>
        <div className="rounded-lg bg-accent/70 p-3.5">
          <p className="text-xs font-semibold tracking-wide text-accent-foreground uppercase">{t("successMeasure")}</p>
          <p className="mt-1 text-sm">{brief.success_measure}</p>
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">{t("audiences")}</h3>
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {brief.audiences.map((audience, i) => (
              <li key={i} className="rounded-lg border p-3 text-sm">
                <p className="font-medium">{audience.segment}</p>
                <p className="mt-1 text-muted-foreground">{audience.message}</p>
              </li>
            ))}
          </ul>
        </div>
        <FactsUsed facts={brief.facts_used} />
      </CardContent>
    </Card>
  );
}

function Angles({ brief }: { brief: CampaignBrief }) {
  const t = useTranslations("campaigns.brief");
  return (
    <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {brief.angles.map((angle, i) => {
        const idea = `${angle.name}: ${angle.insight}\n${angle.opening_line}`;
        return (
          <li key={i}>
            <Card className="h-full gap-3 py-4">
              <CardHeader className="px-4">
                <CardTitle className="font-bold">{angle.name}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-3 px-4 text-sm">
                <div>
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t("insight")}</p>
                  <p className="mt-0.5">{angle.insight}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t("openingLine")}</p>
                  <p className="mt-0.5 italic">“{angle.opening_line}”</p>
                </div>
                <Button asChild variant="outline" size="sm" className="mt-auto self-start">
                  <Link href={`/studio?idea=${encodeURIComponent(idea)}`}>
                    <PenLine />
                    {t("writeContent")}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}

function AbTest({ brief }: { brief: CampaignBrief }) {
  const t = useTranslations("campaigns.brief");
  const tCampaigns = useTranslations("campaigns");
  const test = brief.ab_test;

  return (
    <Card className="gap-5 py-5">
      <CardContent className="space-y-5 px-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {(["a", "b"] as const).map((name) => {
            const variant = name === "a" ? test.variant_a : test.variant_b;
            return (
              <div key={name} className="space-y-2 rounded-lg border p-4 text-sm">
                <p className="text-xs font-semibold tracking-wide text-primary uppercase">
                  {t("variant", { name: name.toUpperCase() })}
                </p>
                <Field label={t("angle")} value={variant.angle} />
                <Field label={t("headline")} value={variant.headline} strong />
                <Field label={t("message")} value={variant.message} />
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <Field label={t("hypothesis")} value={test.hypothesis} />
          <Field label={t("metric")} value={test.metric} />
          <Field label={t("testLength")} value={tCampaigns("durationDays", { days: test.duration_days })} />
          <Field label={t("audienceAndBudget")} value={test.audience_and_budget} />
          <Field label={t("decisionRule")} value={test.decision_rule} />
        </div>
      </CardContent>
    </Card>
  );
}

function LaunchPlan({ brief }: { brief: CampaignBrief }) {
  const tChannels = useTranslations("campaigns.channels");
  return (
    <Card className="py-2">
      <CardContent className="px-0">
        <ol className="divide-y">
          {brief.launch_plan.map((step, i) => {
            const Icon = CHANNEL_ICONS[step.channel];
            return (
              <li key={i} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3 px-5 py-3 text-sm">
                <span className="font-medium">{step.when}</span>
                <div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
                    <Icon className="size-3" />
                    {tChannels(step.channel)}
                  </span>
                  <p className="mt-1">{step.action}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

function ChannelAssets({ brief, generationId }: { brief: CampaignBrief; generationId: string }) {
  const tChannels = useTranslations("campaigns.channels");
  return (
    <div className="space-y-3">
      {brief.channel_assets.map((asset, i) => {
        const Icon = CHANNEL_ICONS[asset.channel];
        const text = `${asset.title}\n\n${asset.copy}`;
        return (
          <Card key={i} className="gap-3 py-4">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 px-5">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Icon className="size-3.5" />
                  {tChannels(asset.channel)}
                </p>
                <CardTitle className="mt-0.5 font-bold">{asset.title}</CardTitle>
              </div>
              <div className="flex flex-wrap gap-2">
                <CopyButton text={text} />
                <SaveDraftButton
                  generationId={generationId}
                  assetType={asset.channel}
                  title={asset.title}
                  body={asset.copy}
                  variant="outline"
                />
              </div>
            </CardHeader>
            <CardContent className="px-5">
              <p className="text-sm leading-relaxed whitespace-pre-line">{asset.copy}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function Field({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className={strong ? "mt-0.5 font-semibold" : "mt-0.5"}>{value}</p>
    </div>
  );
}
