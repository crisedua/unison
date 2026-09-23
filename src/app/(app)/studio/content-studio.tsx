"use client";

import { Loader2, Sparkles, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ASSET_ICONS } from "@/components/content-set/asset-icons";
import { ContentSetView, type SetSettings } from "@/components/content-set/content-set-view";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { missingFacts, type FactKey } from "@/lib/brain/facts";
import {
  ASSET_TYPES,
  DEFAULT_ASSETS,
  LENGTHS,
  requiredFactsFor,
  TONES,
  type AssetType,
  type ContentSetOutput,
  type Length,
  type Tone,
} from "@/lib/engine/assets";
import { CONTENT_LANGUAGES, isContentLanguage, type ContentLanguage } from "@/lib/languages";
import type { BrandDocument } from "@/lib/types";
import { cn } from "@/lib/utils";
import { generateContentSet, type GenerateError } from "./actions";

type Props = {
  status: Record<FactKey, boolean>;
  documents: Pick<BrandDocument, "id" | "title" | "kind">[];
  defaultLanguage: ContentLanguage;
  aiConfigured: boolean;
  /** Prefilled idea, e.g. an angle sent over from the Campaign Studio. */
  initialIdea?: string;
};

type Result = { output: ContentSetOutput; generationId: string | null; settings: SetSettings };

const NO_SOURCE = "none";

export function ContentStudio({ status, documents, defaultLanguage, aiConfigured, initialIdea = "" }: Props) {
  const t = useTranslations("studio");
  const tErrors = useTranslations("errors");
  const tFacts = useTranslations("facts");
  const tLanguages = useTranslations("languages");

  const [idea, setIdea] = useState(initialIdea);
  const [sourceId, setSourceId] = useState(NO_SOURCE);
  const [assets, setAssets] = useState<AssetType[]>(DEFAULT_ASSETS);
  const [length, setLength] = useState<Length>("standard");
  const [tone, setTone] = useState<Tone>("on_brand");
  const [customTone, setCustomTone] = useState("");
  const [language, setLanguage] = useState<ContentLanguage>(defaultLanguage);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<GenerateError | null>(null);
  const [pending, startTransition] = useTransition();

  const missing = missingFacts(status, requiredFactsFor(assets));
  const canGenerate = aiConfigured && missing.length === 0 && assets.length > 0 && !pending;

  function toggleAsset(type: AssetType) {
    setAssets((current) => (current.includes(type) ? current.filter((a) => a !== type) : [...current, type]));
  }

  function generate() {
    if (assets.length === 0) return toast.error(t("pickOne"));
    if (!idea.trim() && sourceId === NO_SOURCE) return toast.error(t("needIdea"));

    const settings: SetSettings = { length, tone, language };
    startTransition(async () => {
      setError(null);
      try {
        const response = await generateContentSet({
          idea,
          sourceDocumentId: sourceId === NO_SOURCE ? null : sourceId,
          assets,
          length,
          tone,
          customTone,
          language,
        });
        if (!response.ok) {
          setError(response.error);
          return;
        }
        setResult({ output: response.output, generationId: response.generationId, settings });
        if (response.generationId) toast.success(t("savedToLibrary"));
        else toast.warning(t("notSaved"));
      } catch {
        setError({ code: "ai_failed" });
      }
    });
  }

  return (
    <div>
      <PageHeader title={t("title")} description={t("subtitle")} />

      {!aiConfigured && (
        <Alert className="mb-6 border-warning-foreground/20 bg-warning text-warning-foreground">
          <TriangleAlert />
          <AlertTitle>{t("aiMissingTitle")}</AlertTitle>
          <AlertDescription className="text-warning-foreground/90">{t("aiMissingBody")}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[400px_minmax(0,1fr)]">
        <Card className="py-5 xl:sticky xl:top-8">
          <CardContent className="space-y-5 px-5">
            <div className="space-y-2">
              <Label htmlFor="idea">{t("ideaLabel")}</Label>
              <Textarea
                id="idea"
                value={idea}
                maxLength={6000}
                placeholder={t("ideaPlaceholder")}
                onChange={(e) => setIdea(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && canGenerate) generate();
                }}
                className="max-h-72 min-h-28 bg-card"
              />
            </div>

            {documents.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="source">{t("sourceLabel")}</Label>
                <Select value={sourceId} onValueChange={setSourceId}>
                  <SelectTrigger id="source" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_SOURCE}>{t("sourceNone")}</SelectItem>
                    {documents.map((doc) => (
                      <SelectItem key={doc.id} value={doc.id}>
                        {doc.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{t("sourceHelp")}</p>
              </div>
            )}

            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm font-medium">{t("assetsLabel")}</legend>
              <div className="grid grid-cols-2 gap-2">
                {ASSET_TYPES.map((type) => {
                  const Icon = ASSET_ICONS[type];
                  const selected = assets.includes(type);
                  return (
                    <button
                      key={type}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleAsset(type)}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-sm transition-colors",
                        selected
                          ? "border-primary bg-accent font-medium text-accent-foreground"
                          : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="leading-tight">{t(`assets.${type}`)}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm font-medium">{t("lengthLabel")}</legend>
              <div className="grid grid-cols-3 rounded-lg bg-muted p-0.5">
                {LENGTHS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={length === option}
                    onClick={() => setLength(option)}
                    className={cn(
                      "rounded-md py-1.5 text-sm transition-colors",
                      length === option
                        ? "bg-card font-medium text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {t(`lengths.${option}`)}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tone">{t("toneLabel")}</Label>
                <Select value={tone} onValueChange={(value) => setTone(value as Tone)}>
                  <SelectTrigger id="tone" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TONES.map((option) => (
                      <SelectItem key={option} value={option}>
                        {t(`tones.${option}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

            <div className="space-y-2">
              <Label htmlFor="custom-tone">{t("customToneLabel")}</Label>
              <Input
                id="custom-tone"
                value={customTone}
                maxLength={300}
                placeholder={t("customTonePlaceholder")}
                onChange={(e) => setCustomTone(e.target.value)}
              />
            </div>

            {missing.length > 0 && <MissingFacts missing={missing} />}

            <Button className="h-11 w-full text-base" disabled={!canGenerate} onClick={generate}>
              {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
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
                  {t("generatingHint", { count: assets.length })}
                </p>
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-11/12" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-40 w-full" />
              </CardContent>
            </Card>
          ) : error ? (
            <Alert variant="destructive" className="py-3">
              <TriangleAlert />
              <AlertTitle>{tErrors(error.code)}</AlertTitle>
              {error.code === "missing_facts" && (
                <AlertDescription>
                  {error.missing.map((key) => tFacts(key)).join(", ")} ·{" "}
                  <Link href="/brain">{t("goToBrain")}</Link>
                </AlertDescription>
              )}
            </Alert>
          ) : result ? (
            <ContentSetView output={result.output} generationId={result.generationId} settings={result.settings} />
          ) : (
            <div className="flex min-h-80 flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <Sparkles className="size-5" />
              </div>
              <h2 className="text-lg font-bold">{t("emptyTitle")}</h2>
              <p className="max-w-sm text-sm text-muted-foreground">{t("emptyBody")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MissingFacts({ missing }: { missing: FactKey[] }) {
  const t = useTranslations("studio");
  const tFacts = useTranslations("facts");

  return (
    <div className="space-y-2 rounded-lg border border-warning-foreground/20 bg-warning p-3 text-sm text-warning-foreground">
      <p className="font-medium">{t("missingTitle")}</p>
      <p>
        {t("missingBody")} {missing.map((key) => tFacts(key)).join(", ")}
      </p>
      <Link href="/brain" className="inline-block font-medium underline underline-offset-2">
        {t("goToBrain")}
      </Link>
    </div>
  );
}
