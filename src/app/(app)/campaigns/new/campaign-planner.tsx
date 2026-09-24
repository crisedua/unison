"use client";

import { ArrowLeft, Loader2, Megaphone } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ActionError, AiMissingAlert, MissingFactsNotice } from "@/components/action-error";
import { CHANNEL_ICONS } from "@/components/campaigns/channel-icons";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { FactKey } from "@/lib/brain/facts";
import {
  CAMPAIGN_DURATIONS,
  CAMPAIGN_GOALS,
  CHANNELS,
  DEFAULT_CHANNELS,
  type CampaignDuration,
  type CampaignGoal,
  type Channel,
} from "@/lib/campaigns/schema";
import { CONTENT_LANGUAGES, isContentLanguage, type ContentLanguage } from "@/lib/languages";
import { cn } from "@/lib/utils";
import { planCampaign, type PlanResult } from "../actions";

type Props = {
  missing: FactKey[];
  defaultLanguage: ContentLanguage;
  aiConfigured: boolean;
};

type PlanError = Extract<PlanResult, { ok: false }>["error"];

export function CampaignPlanner({ missing, defaultLanguage, aiConfigured }: Props) {
  const t = useTranslations("campaigns");
  const tLanguages = useTranslations("languages");
  const router = useRouter();

  const [goal, setGoal] = useState<CampaignGoal>("launch_offer");
  const [offer, setOffer] = useState("");
  const [audience, setAudience] = useState("");
  const [channels, setChannels] = useState<Channel[]>(DEFAULT_CHANNELS);
  const [durationDays, setDurationDays] = useState<CampaignDuration>(14);
  const [budget, setBudget] = useState("");
  const [language, setLanguage] = useState<ContentLanguage>(defaultLanguage);
  const [error, setError] = useState<PlanError | null>(null);
  const [pending, startTransition] = useTransition();

  const canGenerate = aiConfigured && missing.length === 0 && !pending;

  function toggleChannel(channel: Channel) {
    setChannels((current) =>
      current.includes(channel) ? current.filter((c) => c !== channel) : [...current, channel],
    );
  }

  function generate() {
    if (channels.length === 0) return toast.error(t("pickChannel"));
    if (goal === "custom" && !offer.trim()) return toast.error(t("describeGoal"));

    startTransition(async () => {
      setError(null);
      try {
        const response = await planCampaign({ goal, offer, audience, channels, durationDays, budget, language });
        if (!response.ok) {
          setError(response.error);
          return;
        }
        router.push(`/campaigns/${response.campaignId}`);
      } catch {
        setError({ code: "ai_failed" });
      }
    });
  }

  return (
    <div>
      <Link
        href="/campaigns"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {t("backToCampaigns")}
      </Link>
      <PageHeader title={t("newCampaign")} description={t("planSubtitle")} />

      {!aiConfigured && <AiMissingAlert />}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[440px_minmax(0,1fr)]">
        <Card className="py-5">
          <CardContent className="space-y-5 px-5">
            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm font-medium">{t("goalLabel")}</legend>
              <div className="grid grid-cols-2 gap-2">
                {CAMPAIGN_GOALS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={goal === option}
                    onClick={() => setGoal(option)}
                    className={cn(
                      "rounded-lg border px-2.5 py-2 text-left text-sm leading-tight transition-colors",
                      goal === option
                        ? "border-primary bg-accent font-medium text-accent-foreground"
                        : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {t(`goals.${option}`)}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="space-y-2">
              <Label htmlFor="offer">{goal === "custom" ? t("offerLabelCustom") : t("offerLabel")}</Label>
              <Textarea
                id="offer"
                value={offer}
                maxLength={1000}
                placeholder={t("offerPlaceholder")}
                onChange={(e) => setOffer(e.target.value)}
                className="min-h-20 bg-card"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="audience">{t("audienceLabel")}</Label>
              <Textarea
                id="audience"
                value={audience}
                maxLength={1000}
                placeholder={t("audiencePlaceholder")}
                onChange={(e) => setAudience(e.target.value)}
                className="min-h-16 bg-card"
              />
            </div>

            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm font-medium">{t("channelsLabel")}</legend>
              <div className="grid grid-cols-2 gap-2">
                {CHANNELS.map((channel) => {
                  const Icon = CHANNEL_ICONS[channel];
                  const selected = channels.includes(channel);
                  return (
                    <button
                      key={channel}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleChannel(channel)}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-sm transition-colors",
                        selected
                          ? "border-primary bg-accent font-medium text-accent-foreground"
                          : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="leading-tight">{t(`channels.${channel}`)}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm font-medium">{t("durationLabel")}</legend>
              <div className="grid grid-cols-4 rounded-lg bg-muted p-0.5">
                {CAMPAIGN_DURATIONS.map((days) => (
                  <button
                    key={days}
                    type="button"
                    aria-pressed={durationDays === days}
                    onClick={() => setDurationDays(days)}
                    className={cn(
                      "rounded-md py-1.5 text-sm transition-colors",
                      durationDays === days
                        ? "bg-card font-medium text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {t("durationDays", { days })}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="budget">{t("budgetLabel")}</Label>
                <Input
                  id="budget"
                  value={budget}
                  maxLength={200}
                  placeholder={t("budgetPlaceholder")}
                  onChange={(e) => setBudget(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="language">{t("languageLabel")}</Label>
                <Select value={language} onValueChange={(value) => isContentLanguage(value) && setLanguage(value)}>
                  <SelectTrigger id="language" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTENT_LANGUAGES.map((option) => (
                      <SelectItem key={option} value={option}>
                        {tLanguages(option)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {missing.length > 0 && <MissingFactsNotice missing={missing} />}

            <Button className="h-11 w-full text-base" disabled={!canGenerate} onClick={generate}>
              {pending ? <Loader2 className="animate-spin" /> : <Megaphone />}
              {pending ? t("generating") : t("generate")}
            </Button>
          </CardContent>
        </Card>

        <div className="min-w-0">
          {pending ? (
            <Card className="gap-4 py-6">
              <CardContent className="space-y-4 px-6">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <Loader2 className="size-4 animate-spin text-primary" />
                  {t("generatingHint")}
                </p>
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-11/12" />
                <Skeleton className="h-40 w-full" />
              </CardContent>
            </Card>
          ) : error ? (
            <ActionError error={error} />
          ) : (
            <div className="flex min-h-80 flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <Megaphone className="size-5" />
              </div>
              <p className="max-w-sm text-sm text-muted-foreground">{t("subtitle")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
