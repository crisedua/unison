"use client";

import { ChartLine, Loader2, Save, Sparkles } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { analyzeCampaign, saveCampaignResults, type AnalyzeResult } from "@/app/(app)/campaigns/actions";
import { ActionError } from "@/components/action-error";
import { ReadoutView } from "@/components/campaigns/readout-view";
import { Verdict } from "@/components/campaigns/verdict";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { hasResults, type CampaignMetrics, type Readout, type VariantMetrics } from "@/lib/campaigns/schema";
import { compareVariants, costPer, rate } from "@/lib/campaigns/stats";
import { CONTENT_LANGUAGES, isContentLanguage, type ContentLanguage } from "@/lib/languages";

const FIELDS = ["reached", "clicks", "conversions", "spend"] as const;
type Field = (typeof FIELDS)[number];
type VariantForm = Record<Field, string>;

type Saved = { conversionLabel: string; variantA: string; variantB: string; metrics: CampaignMetrics };
export type StoredReadout = { id: string; readout: Readout; createdAt: string };

const toForm = (v: VariantMetrics): VariantForm => ({
  reached: v.reached ? String(v.reached) : "",
  clicks: v.clicks ? String(v.clicks) : "",
  conversions: v.conversions ? String(v.conversions) : "",
  spend: v.spend ? String(v.spend) : "",
});

/** Empty counts as 0; anything else must be a non-negative number (whole for counts). */
function toMetrics(form: VariantForm): VariantMetrics | null {
  const values = FIELDS.map((field) => {
    const raw = form[field].trim().replace(",", ".");
    if (!raw) return 0;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) return null;
    return field === "spend" ? Math.round(value * 100) / 100 : Number.isInteger(value) ? value : null;
  });
  if (values.some((v) => v === null)) return null;
  const [reached, clicks, conversions, spend] = values as number[];
  return { reached, clicks, conversions, spend };
}

export function ResultsPanel({
  campaignId,
  initial,
  readouts,
  defaultLanguage,
}: {
  campaignId: string;
  initial: Saved;
  readouts: StoredReadout[];
  defaultLanguage: ContentLanguage;
}) {
  const t = useTranslations("results");
  const tCampaigns = useTranslations("campaigns");
  const tLanguages = useTranslations("languages");
  const tCommon = useTranslations("common");
  const format = useFormatter();

  const [saved, setSaved] = useState(initial);
  const [conversionLabel, setConversionLabel] = useState(initial.conversionLabel);
  const [variantA, setVariantA] = useState(initial.variantA);
  const [variantB, setVariantB] = useState(initial.variantB);
  const [forms, setForms] = useState({ a: toForm(initial.metrics.a), b: toForm(initial.metrics.b) });
  const [notes, setNotes] = useState(initial.metrics.notes);
  const [language, setLanguage] = useState<ContentLanguage>(defaultLanguage);
  const [fresh, setFresh] = useState<Extract<AnalyzeResult, { ok: true }> | null>(null);
  const [error, setError] = useState<Extract<AnalyzeResult, { ok: false }>["error"] | null>(null);
  const [saving, startSaving] = useTransition();
  const [analyzing, startAnalyzing] = useTransition();

  const a = toMetrics(forms.a);
  const b = toMetrics(forms.b);
  const current: CampaignMetrics | null = a && b ? { a, b, notes } : null;
  const dirty =
    conversionLabel !== saved.conversionLabel ||
    variantA !== saved.variantA ||
    variantB !== saved.variantB ||
    JSON.stringify(current) !== JSON.stringify(saved.metrics);
  const comparison = current ? compareVariants(current.a, current.b) : null;
  const label = conversionLabel.trim() || t("conversions");

  function setField(variant: "a" | "b", field: Field, value: string) {
    setForms((prev) => ({ ...prev, [variant]: { ...prev[variant], [field]: value } }));
  }

  function save() {
    if (!current) return toast.error(t("invalid"));
    const input = { conversionLabel, variantA, variantB, metrics: current };
    startSaving(async () => {
      const result = await saveCampaignResults(campaignId, input);
      if (!result.ok) {
        toast.error(
          result.error === "inconsistent" ? t("inconsistent") : result.error === "invalid" ? t("invalid") : t("errors.failed"),
        );
        return;
      }
      setSaved({ conversionLabel: conversionLabel.trim(), variantA: variantA.trim(), variantB: variantB.trim(), metrics: current });
      setConversionLabel((v) => v.trim());
      setVariantA((v) => v.trim());
      setVariantB((v) => v.trim());
      toast.success(t("saved"));
    });
  }

  function analyze() {
    if (dirty) return toast.error(t("saveFirst"));
    if (!hasResults(saved.metrics)) return toast.error(t("needResults"));
    startAnalyzing(async () => {
      setError(null);
      try {
        const response = await analyzeCampaign(campaignId, { language });
        if (!response.ok) {
          setError(response.error);
          return;
        }
        setFresh(response);
      } catch {
        setError({ code: "ai_failed" });
      }
    });
  }

  const percent = (value: number | null) =>
    value === null ? "—" : format.number(value, { style: "percent", maximumFractionDigits: 2 });
  const money = (value: number | null) =>
    value === null ? "—" : format.number(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // A read-out that couldn't be saved isn't in `readouts`; show it on top until the page reloads.
  const latest =
    fresh && !fresh.generationId
      ? { id: null, readout: fresh.readout }
      : readouts[0]
        ? { id: readouts[0].id, readout: readouts[0].readout }
        : null;
  const earlier = fresh && !fresh.generationId ? readouts : readouts.slice(1);

  return (
    <section id="results" className="scroll-mt-8 space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <ChartLine className="size-5 text-primary" />
          {t("sectionTitle")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("sectionBody")}</p>
      </div>

      <Card className="gap-5 py-5">
        <CardContent className="space-y-5 px-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="variant-a">{t("variantALabel")}</Label>
              <Input id="variant-a" value={variantA} maxLength={500} onChange={(e) => setVariantA(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="variant-b">{t("variantBLabel")}</Label>
              <Input id="variant-b" value={variantB} maxLength={500} onChange={(e) => setVariantB(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="conversion-label">{t("conversionLabel")}</Label>
              <Input
                id="conversion-label"
                value={conversionLabel}
                maxLength={120}
                placeholder={t("conversionPlaceholder")}
                onChange={(e) => setConversionLabel(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium" />
                  <th className="pb-2 font-medium">
                    {t("reached")}
                    <span className="block font-normal">{t("reachedHelp")}</span>
                  </th>
                  <th className="pb-2 align-top font-medium">{t("clicks")}</th>
                  <th className="pb-2 align-top font-medium">{label}</th>
                  <th className="pb-2 align-top font-medium">{t("spend")}</th>
                </tr>
              </thead>
              <tbody>
                {(["a", "b"] as const).map((variant) => (
                  <tr key={variant}>
                    <th scope="row" className="py-1.5 pr-3 text-left font-semibold whitespace-nowrap">
                      {t("variant", { name: variant.toUpperCase() })}
                    </th>
                    {FIELDS.map((field) => (
                      <td key={field} className="py-1.5 pr-2">
                        <Input
                          inputMode={field === "spend" ? "decimal" : "numeric"}
                          aria-label={`${t("variant", { name: variant.toUpperCase() })} · ${field === "conversions" ? label : t(field)}`}
                          value={forms[variant][field]}
                          placeholder="0"
                          onChange={(e) => setField(variant, field, e.target.value)}
                          aria-invalid={toMetrics(forms[variant]) === null || undefined}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {current && hasResults(current) && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <table className="text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="pb-1.5 font-medium" />
                    <th className="pb-1.5 font-medium">{t("clickRate")}</th>
                    <th className="pb-1.5 font-medium">{t("resultRate")}</th>
                    <th className="pb-1.5 font-medium">{t("costPerResult")}</th>
                  </tr>
                </thead>
                <tbody>
                  {(["a", "b"] as const).map((variant) => {
                    const v = current[variant];
                    return (
                      <tr key={variant}>
                        <th scope="row" className="py-1 pr-3 text-left font-semibold">
                          {variant.toUpperCase()}
                        </th>
                        <td className="py-1 tabular-nums">{percent(rate(v.clicks, v.reached))}</td>
                        <td className="py-1 tabular-nums">{percent(rate(v.conversions, v.reached))}</td>
                        <td className="py-1 tabular-nums">{money(costPer(v.spend, v.conversions))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {comparison && <Verdict comparison={comparison} />}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="results-notes">{t("notesLabel")}</Label>
            <Textarea
              id="results-notes"
              value={notes}
              maxLength={4000}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-16 bg-card"
            />
          </div>

          <div className="flex flex-wrap items-end justify-between gap-3 border-t pt-4">
            <Button variant="outline" onClick={save} disabled={!dirty || saving || !current}>
              {saving ? <Loader2 className="animate-spin" /> : <Save />}
              {saving ? tCommon("saving") : t("save")}
            </Button>
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="readout-language" className="text-xs">
                  {tCampaigns("languageLabel")}
                </Label>
                <Select value={language} onValueChange={(value) => isContentLanguage(value) && setLanguage(value)}>
                  <SelectTrigger id="readout-language" className="w-52">
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
              <Button onClick={analyze} disabled={analyzing || !hasResults(saved.metrics)}>
                {analyzing ? <Loader2 className="animate-spin" /> : <Sparkles />}
                {analyzing ? t("analyzing") : t("analyze")}
              </Button>
            </div>
          </div>
          {dirty && hasResults(saved.metrics) && <p className="text-xs text-muted-foreground">{t("saveFirst")}</p>}
        </CardContent>
      </Card>

      {analyzing ? (
        <Card className="gap-4 py-6">
          <CardContent className="space-y-4 px-6">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Loader2 className="size-4 animate-spin text-primary" />
              {t("analyzeHint")}
            </p>
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      ) : error ? (
        <ActionError error={error} />
      ) : null}

      {latest && !analyzing && (
        <Card className="gap-4 py-5">
          <CardHeader className="px-5">
            <CardTitle className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {t("readoutTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5">
            <ReadoutView key={latest.id ?? "unsaved"} readout={latest.readout} generationId={latest.id} />
          </CardContent>
        </Card>
      )}

      {earlier.length > 0 && (
        <Card className="gap-2 py-4">
          <CardHeader className="px-5">
            <CardTitle className="text-sm font-semibold">{t("previousReadouts")}</CardTitle>
          </CardHeader>
          <CardContent className="divide-y px-5">
            {earlier.map((item) => (
              <details key={item.id} className="group py-3">
                <summary className="cursor-pointer text-sm font-medium">
                  {item.readout.headline}{" "}
                  <span className="font-normal text-muted-foreground">
                    · {format.dateTime(new Date(item.createdAt), { dateStyle: "medium", timeStyle: "short" })}
                  </span>
                </summary>
                <div className="pt-4">
                  <ReadoutView readout={item.readout} generationId={item.id} />
                </div>
              </details>
            ))}
          </CardContent>
        </Card>
      )}
    </section>
  );
}
