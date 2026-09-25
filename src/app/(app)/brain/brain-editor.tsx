"use client";

import { Check, Circle, CircleCheck, Lightbulb } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { siteConfig } from "@/config/site";
import { BRAIN_FIELD_MAX_LENGTH, FACT_KEYS, factStatus, type BrainField, type FactKey } from "@/lib/brain/facts";
import { CONTENT_LANGUAGES, isContentLanguage } from "@/lib/languages";
import type { Brand, BrandDocument } from "@/lib/types";
import type { VisualStyle } from "@/lib/brain/visual";
import { cn } from "@/lib/utils";
import { saveBrain, type BrainFormValues } from "./actions";
import { DocumentsPanel } from "./documents-panel";
import { VisualStyleCard } from "./visual-style-card";

const MAIN_FIELDS = ["company", "audience", "problem", "positioning", "offer", "proof"] as const;
const VOICE_FIELDS = ["voice_tone", "voice_use", "voice_avoid", "voice_example"] as const;

/** Where each fact lives on the page, for the "still missing" shortcuts. */
const FACT_ANCHOR: Record<FactKey, string> = {
  company: "company",
  audience: "audience",
  problem: "problem",
  positioning: "positioning",
  offer: "offer",
  proof: "proof",
  voice: "voice",
  notes: "notes",
};

function toFormValues(brand: Brand): BrainFormValues {
  return {
    name: brand.name,
    content_language: brand.content_language,
    company: brand.company,
    audience: brand.audience,
    problem: brand.problem,
    positioning: brand.positioning,
    offer: brand.offer,
    proof: brand.proof,
    voice_tone: brand.voice_tone,
    voice_use: brand.voice_use,
    voice_avoid: brand.voice_avoid,
    voice_example: brand.voice_example,
  };
}

export function BrainEditor({
  brand,
  documents,
  visual,
}: {
  brand: Brand;
  documents: BrandDocument[];
  visual: { available: boolean; style: VisualStyle };
}) {
  const t = useTranslations("brain");
  const tBrand = useTranslations("brand");
  const tFacts = useTranslations("facts");
  const tLanguages = useTranslations("languages");
  const tCommon = useTranslations("common");

  const [values, setValues] = useState<BrainFormValues>(() => toFormValues(brand));
  const [saved, setSaved] = useState<BrainFormValues>(values);
  const [pending, startTransition] = useTransition();

  const dirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(saved), [values, saved]);
  const status = factStatus(values, documents.length);
  const filledCount = FACT_KEYS.filter((key) => status[key]).length;
  const missing = FACT_KEYS.filter((key) => !status[key]);

  const setField = (key: keyof BrainFormValues, value: string) => setValues((v) => ({ ...v, [key]: value }));

  const save = useCallback(() => {
    if (!dirty || pending) return;
    const snapshot = values;
    startTransition(async () => {
      const result = await saveBrain(brand.id, snapshot);
      if (result.ok) {
        setSaved(snapshot);
        toast.success(t("saved"));
      } else {
        toast.error(t(`errors.${result.error}`));
      }
    });
  }, [brand.id, dirty, pending, t, values]);

  // Warn before leaving with unsaved changes; Cmd/Ctrl+S saves.
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        save();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [dirty, save]);

  const jumpTo = (key: FactKey) =>
    document.getElementById(FACT_ANCHOR[key])?.scrollIntoView({ behavior: "smooth", block: "center" });

  return (
    <div className="pb-24">
      <PageHeader title={t("title")} description={t("subtitle", { name: siteConfig.name })} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <aside className="order-first space-y-4 lg:sticky lg:top-8 lg:order-none lg:col-start-2 lg:row-start-1 lg:h-fit">
          <Card className="gap-3 py-5">
            <CardContent className="space-y-3 px-5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {t("meterLabel")}
                </span>
                <span className="font-heading text-sm font-bold">
                  {t("meterCount", { filled: filledCount, total: FACT_KEYS.length })}
                </span>
              </div>
              <Progress value={(filledCount / FACT_KEYS.length) * 100} className="h-2" />
              {missing.length === 0 ? (
                <p className="flex items-center gap-1.5 text-sm text-success">
                  <CircleCheck className="size-4" />
                  {t("meterComplete")}
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">{t("meterMissing")}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {missing.map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => jumpTo(key)}
                        className="rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
                      >
                        {tFacts(key)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          <div className="hidden rounded-xl border border-dashed p-4 text-sm lg:block">
            <p className="mb-1 flex items-center gap-1.5 font-medium">
              <Lightbulb className="size-4 text-primary" />
              {t("tipTitle")}
            </p>
            <p className="text-muted-foreground">{t("tipBody")}</p>
          </div>
        </aside>

        <div className="min-w-0 space-y-5 lg:col-start-1 lg:row-start-1">
          <Card className="gap-4 py-5">
            <CardHeader className="px-5">
              <CardTitle className="font-bold">{t("settingsTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 px-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="brand-name">{tBrand("nameLabel")}</Label>
                <Input
                  id="brand-name"
                  value={values.name}
                  maxLength={80}
                  onChange={(e) => setField("name", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="content-language">{tBrand("languageLabel")}</Label>
                <Select
                  value={values.content_language}
                  onValueChange={(value) => isContentLanguage(value) && setField("content_language", value)}
                >
                  <SelectTrigger id="content-language" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTENT_LANGUAGES.map((language) => (
                      <SelectItem key={language} value={language}>
                        {tLanguages(language)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground sm:col-span-2">{tBrand("languageHelp")}</p>
            </CardContent>
          </Card>

          {MAIN_FIELDS.map((key) => (
            <FieldCard
              key={key}
              field={key}
              factLabel={tFacts(key)}
              filled={status[key]}
              value={values[key]}
              onChange={(value) => setField(key, value)}
            />
          ))}

          <Card id="voice" className="scroll-mt-24 gap-4 py-5">
            <CardHeader className="px-5">
              <FactTitle label={t("voiceTitle")} filled={status.voice} />
              <CardDescription>{t("voiceHelp")}</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-5 px-5 sm:grid-cols-2">
              {VOICE_FIELDS.map((key) => (
                <div key={key} className={cn("space-y-2", key === "voice_tone" || key === "voice_example" ? "sm:col-span-2" : "")}>
                  <Label htmlFor={key}>{t(`fields.${key}.label`)}</Label>
                  <Textarea
                    id={key}
                    value={values[key]}
                    maxLength={BRAIN_FIELD_MAX_LENGTH}
                    placeholder={t(`fields.${key}.placeholder`)}
                    onChange={(e) => setField(key, e.target.value)}
                    className="min-h-14 bg-card"
                  />
                  <p className="text-xs text-muted-foreground">{t(`fields.${key}.help`)}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <VisualStyleCard brandId={brand.id} initial={visual.style} available={visual.available} />

          <DocumentsPanel brandId={brand.id} documents={documents} filled={status.notes} />
        </div>
      </div>

      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 backdrop-blur transition-transform md:left-64",
          dirty ? "translate-y-0" : "translate-y-full",
        )}
        aria-hidden={!dirty}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-10">
          <span className="text-sm text-muted-foreground">{t("unsaved")}</span>
          <Button onClick={save} disabled={!dirty || pending} tabIndex={dirty ? 0 : -1}>
            <Check />
            {pending ? tCommon("saving") : t("saveChanges")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function FactTitle({ label, filled }: { label: string; filled: boolean }) {
  return (
    <CardTitle className="flex items-center gap-2 font-bold">
      {filled ? (
        <CircleCheck className="size-4 text-success" aria-hidden />
      ) : (
        <Circle className="size-4 text-muted-foreground/50" aria-hidden />
      )}
      {label}
    </CardTitle>
  );
}

function FieldCard({
  field,
  factLabel,
  filled,
  value,
  onChange,
}: {
  field: Exclude<BrainField, (typeof VOICE_FIELDS)[number]>;
  factLabel: string;
  filled: boolean;
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useTranslations("brain.fields");

  return (
    <Card id={field} className="scroll-mt-24 gap-3 py-5">
      <CardHeader className="px-5">
        <div className="flex items-center justify-between gap-2">
          <FactTitle label={t(`${field}.label`)} filled={filled} />
          <span className="text-xs text-muted-foreground">{factLabel}</span>
        </div>
        <CardDescription>{t(`${field}.help`)}</CardDescription>
      </CardHeader>
      <CardContent className="px-5">
        <Textarea
          aria-label={t(`${field}.label`)}
          value={value}
          maxLength={BRAIN_FIELD_MAX_LENGTH}
          placeholder={t(`${field}.placeholder`)}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-20 bg-card"
        />
      </CardContent>
    </Card>
  );
}
