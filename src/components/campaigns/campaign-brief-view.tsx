"use client";

import { Download, PenLine } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { CHANNEL_ICONS } from "@/components/campaigns/channel-icons";
import { FactsUsed } from "@/components/content-set/facts-used";
import { downloadText, slugify } from "@/components/content-set/to-markdown";
import { CopyButton, SaveDraftButton } from "@/components/draft-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FUNNEL_STAGES, type CampaignBrief, type EmailProgram } from "@/lib/campaigns/schema";
import { useBriefMarkdown } from "./brief-to-markdown";

const TABS = ["overview", "strategy", "channelPlans", "email", "angles", "abTest", "launchPlan", "assets"] as const;
type Tab = (typeof TABS)[number];

function hasTab(brief: CampaignBrief, tab: Tab) {
  if (tab === "strategy") return Boolean(brief.strategy);
  if (tab === "channelPlans") return Boolean(brief.channel_plans?.length);
  if (tab === "email") return Boolean(brief.email_program);
  return true;
}

export function CampaignBriefView({ brief, generationId }: { brief: CampaignBrief; generationId: string }) {
  const t = useTranslations("campaigns.brief");
  const toMarkdown = useBriefMarkdown();
  const tabs = TABS.filter((tab) => hasTab(brief, tab));

  return (
    <Tabs defaultValue="overview" className="gap-3">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => downloadText(`${slugify(brief.title) || "marketing-plan"}.md`, toMarkdown(brief))}
        >
          <Download />
          {t("download")}
        </Button>
      </div>
      <TabsList className="w-full flex-wrap justify-start gap-1 bg-transparent p-0 group-data-horizontal/tabs:h-auto">
        {tabs.map((tab) => (
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
      {brief.strategy && (
        <TabsContent value="strategy">
          <Strategy strategy={brief.strategy} tracking={brief.tracking ?? []} />
        </TabsContent>
      )}
      {brief.channel_plans && (
        <TabsContent value="channelPlans">
          <ChannelPlans plans={brief.channel_plans} />
        </TabsContent>
      )}
      {brief.email_program && (
        <TabsContent value="email">
          <EmailPlan program={brief.email_program} generationId={generationId} />
        </TabsContent>
      )}
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
        {!brief.strategy && <p className="text-sm text-muted-foreground">{t("olderBrief")}</p>}
        <FactsUsed facts={brief.facts_used} />
      </CardContent>
    </Card>
  );
}

function Strategy({
  strategy,
  tracking,
}: {
  strategy: NonNullable<CampaignBrief["strategy"]>;
  tracking: string[];
}) {
  const t = useTranslations("campaigns.brief");
  const tChannels = useTranslations("campaigns.channels");
  const funnel = FUNNEL_STAGES.flatMap((stage) => strategy.funnel.filter((step) => step.stage === stage));

  return (
    <Card className="gap-5 py-5">
      <CardContent className="space-y-5 px-5">
        <div className="rounded-lg bg-accent/70 p-3.5">
          <p className="text-xs font-semibold tracking-wide text-accent-foreground uppercase">{t("positioning")}</p>
          <p className="mt-1 text-[15px] leading-relaxed">{strategy.positioning}</p>
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">{t("funnel")}</h3>
          <ol className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {funnel.map((step, i) => (
              <li key={i} className="space-y-2 rounded-lg border p-3 text-sm">
                <p className="text-xs font-semibold tracking-wide text-primary uppercase">
                  {i + 1}. {t(`funnelStages.${step.stage}`)}
                </p>
                <p className="font-medium">{step.goal}</p>
                <div className="flex flex-wrap gap-1">
                  {step.channels.map((channel) => {
                    const Icon = CHANNEL_ICONS[channel];
                    return (
                      <span key={channel} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
                        <Icon className="size-3" />
                        {tChannels(channel)}
                      </span>
                    );
                  })}
                </div>
                <Field label={t("tactics")} value={step.tactics} />
              </li>
            ))}
          </ol>
        </div>
        {tracking.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">{t("tracking")}</h3>
            <ol className="list-decimal space-y-1 pl-5 text-sm">
              {tracking.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ChannelPlans({ plans }: { plans: NonNullable<CampaignBrief["channel_plans"]> }) {
  const t = useTranslations("campaigns.brief");
  const tChannels = useTranslations("campaigns.channels");
  return (
    <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {plans.map((plan, i) => {
        const Icon = CHANNEL_ICONS[plan.channel];
        return (
          <li key={i}>
            <Card className="h-full gap-3 py-4">
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 px-5">
                <CardTitle className="flex items-center gap-2 font-bold">
                  <Icon className="size-4 text-primary" />
                  {tChannels(plan.channel)}
                </CardTitle>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                  {plan.budget_share_percent > 0 ? t("budgetShare", { percent: plan.budget_share_percent }) : t("organic")}
                </span>
              </CardHeader>
              <CardContent className="space-y-3 px-5 text-sm">
                <p>{plan.role}</p>
                <Field label={t("targeting")} value={plan.targeting} />
                <Field label={t("setup")} value={plan.setup} />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label={t("formats")} value={plan.formats} />
                  <Field label={t("cadence")} value={plan.cadence} />
                </div>
                <Field label={t("kpi")} value={plan.kpi} />
              </CardContent>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}

function EmailPlan({ program, generationId }: { program: EmailProgram; generationId: string }) {
  const t = useTranslations("campaigns.brief");
  const sequence = [...program.sequence].sort((a, b) => a.send_day - b.send_day);

  return (
    <div className="space-y-3">
      <Card className="gap-4 py-5">
        <CardContent className="grid grid-cols-1 gap-4 px-5 text-sm md:grid-cols-2">
          <Field label={t("listBuilding")} value={program.list_building} />
          <div>
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t("segments")}</p>
            <ul className="mt-0.5 list-disc space-y-0.5 pl-5">
              {program.segments.map((segment, i) => (
                <li key={i}>{segment}</li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      <h3 className="pt-2 text-sm font-semibold">{t("sequence")}</h3>
      {sequence.map((email, i) => {
        const text = `${t("subject")}: ${email.subject}\n${t("previewText")}: ${email.preview_text}\n\n${email.body}`;
        return (
          <Card key={i} className="gap-3 py-4">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 px-5">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">
                  {t("sendDay", { day: email.send_day })} · {email.segment}
                </p>
                <CardTitle className="mt-0.5 font-bold">{email.subject}</CardTitle>
                <p className="mt-0.5 text-sm text-muted-foreground">{email.preview_text}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <CopyButton text={text} />
                <SaveDraftButton
                  generationId={generationId}
                  assetType="email"
                  title={email.subject}
                  body={text}
                  variant="outline"
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-3 px-5 text-sm">
              <Field label={t("purpose")} value={email.purpose} />
              <p className="leading-relaxed whitespace-pre-line">{email.body}</p>
              <Field label={t("cta")} value={email.cta} strong />
            </CardContent>
          </Card>
        );
      })}

      {program.automations.length > 0 && (
        <Card className="gap-3 py-4">
          <CardHeader className="px-5">
            <CardTitle className="font-bold">{t("automations")}</CardTitle>
          </CardHeader>
          <CardContent className="px-5">
            <ul className="divide-y text-sm">
              {program.automations.map((flow, i) => (
                <li key={i} className="grid grid-cols-1 gap-1 py-2 sm:grid-cols-2 sm:gap-3">
                  <Field label={t("trigger")} value={flow.trigger} />
                  <Field label={t("action")} value={flow.action} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
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
