"use client";

import { ExternalLink, Loader2, Search, TriangleAlert, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Credits } from "@/lib/leads/explorium";
import {
  COMPANY_SIZES,
  JOB_LEVELS,
  LEAD_COUNTRIES,
  RESULT_COUNTS,
  toUrl,
  type Lead,
  type LeadSearch,
} from "@/lib/leads/schema";
import { addLeadsAsOpportunities, searchLeads, type LeadSearchResult } from "../actions";

type Props = { configured: boolean; credits: Credits | null };

const EMPTY: LeadSearch = {
  jobTitles: "",
  jobLevels: [],
  industry: "",
  companySizes: [],
  country: "",
  keywords: "",
  count: 25,
};

function toggle<T>(list: T[], value: T, on: boolean) {
  return on ? [...new Set([...list, value])] : list.filter((v) => v !== value);
}

export function FindLeads({ configured, credits: initialCredits }: Props) {
  const t = useTranslations("leads");
  const locale = useLocale();
  const router = useRouter();

  const [search, setSearch] = useState<LeadSearch>(EMPTY);
  const [result, setResult] = useState<LeadSearchResult | null>(null);
  const [credits, setCredits] = useState(initialCredits);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searching, startSearch] = useTransition();
  const [adding, startAdd] = useTransition();

  const countryNames = useMemo(() => new Intl.DisplayNames([locale], { type: "region" }), [locale]);
  const countries = useMemo(
    () =>
      LEAD_COUNTRIES.map((code) => ({ code, name: countryNames.of(code) ?? code })).sort((a, b) =>
        a.name.localeCompare(b.name, locale),
      ),
    [countryNames, locale],
  );

  const leads = result?.ok ? result.leads : [];
  const selectedLeads = leads.filter((lead) => selected.has(lead.id));

  function runSearch(event: React.FormEvent) {
    event.preventDefault();
    startSearch(async () => {
      const next = await searchLeads(search);
      setResult(next);
      if (next.ok) {
        setSelected(new Set(next.leads.map((lead) => lead.id)));
        if (next.credits) setCredits(next.credits);
      }
    });
  }

  function addSelected() {
    if (selectedLeads.length === 0) return;
    startAdd(async () => {
      const outcome = await addLeadsAsOpportunities(selectedLeads);
      if (!outcome.ok) {
        toast.error(t(`errors.${outcome.error}`));
        return;
      }
      toast.success(
        [t("added", { count: outcome.added }), outcome.skipped > 0 && t("skipped", { count: outcome.skipped })]
          .filter(Boolean)
          .join(" "),
      );
      router.push("/sales");
    });
  }

  return (
    <div className="space-y-6">
      {!configured && (
        <Alert className="border-warning-foreground/20 bg-warning text-warning-foreground">
          <TriangleAlert />
          <AlertTitle>{t("notConfiguredTitle")}</AlertTitle>
          <AlertDescription className="text-warning-foreground/90">{t("notConfiguredBody")}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={runSearch} className="space-y-5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="lead-titles">{t("jobTitlesLabel")}</Label>
                <Input
                  id="lead-titles"
                  value={search.jobTitles}
                  maxLength={200}
                  placeholder={t("jobTitlesPlaceholder")}
                  onChange={(e) => setSearch({ ...search, jobTitles: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">{t("jobTitlesHelp")}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lead-industry">{t("industryLabel")}</Label>
                <Input
                  id="lead-industry"
                  value={search.industry}
                  maxLength={120}
                  placeholder={t("industryPlaceholder")}
                  onChange={(e) => setSearch({ ...search, industry: e.target.value })}
                />
              </div>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">{t("jobLevelsLabel")}</legend>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {JOB_LEVELS.map((level) => (
                  <label key={level} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={search.jobLevels.includes(level)}
                      onCheckedChange={(on) =>
                        setSearch({ ...search, jobLevels: toggle(search.jobLevels, level, on === true) })
                      }
                    />
                    {t(`jobLevels.${level}`)}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">{t("companySizesLabel")}</legend>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {COMPANY_SIZES.map((size) => (
                  <label key={size} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={search.companySizes.includes(size)}
                      onCheckedChange={(on) =>
                        setSearch({ ...search, companySizes: toggle(search.companySizes, size, on === true) })
                      }
                    />
                    {size}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="lead-country">{t("countryLabel")}</Label>
                <Select
                  value={search.country || "any"}
                  onValueChange={(value) =>
                    setSearch({ ...search, country: value === "any" ? "" : (value as LeadSearch["country"]) })
                  }
                >
                  <SelectTrigger id="lead-country" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">{t("anyCountry")}</SelectItem>
                    {countries.map(({ code, name }) => (
                      <SelectItem key={code} value={code}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lead-keywords">{t("keywordsLabel")}</Label>
                <Input
                  id="lead-keywords"
                  value={search.keywords}
                  maxLength={200}
                  placeholder={t("keywordsPlaceholder")}
                  onChange={(e) => setSearch({ ...search, keywords: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lead-count">{t("countLabel")}</Label>
                <Select
                  value={String(search.count)}
                  onValueChange={(value) => setSearch({ ...search, count: Number(value) as LeadSearch["count"] })}
                >
                  <SelectTrigger id="lead-count" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RESULT_COUNTS.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{t("countHelp")}</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {credits
                  ? t("credits", { remaining: credits.remaining, type: t(`accountTypes.${credits.accountType}`) })
                  : t("poweredBy")}
              </p>
              <Button type="submit" disabled={!configured || searching}>
                {searching ? <Loader2 className="animate-spin" /> : <Search />}
                {searching ? t("searching") : t("search")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {result && !result.ok && (
        <Alert variant="destructive" className="py-3">
          <TriangleAlert />
          <AlertTitle>{t(`errors.${result.error.code}`)}</AlertTitle>
        </Alert>
      )}

      {result?.ok && leads.length === 0 && (
        <p className="rounded-xl border border-dashed px-6 py-14 text-center text-sm text-muted-foreground">
          {t("noResults")}
        </p>
      )}

      {result?.ok && leads.length > 0 && (
        <section className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold">{t("results", { count: leads.length })}</h2>
              <p className="text-sm text-muted-foreground">
                {t("resultsHint")}
                {result.creditsUsed !== null && ` ${t("used", { count: result.creditsUsed })}`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={selected.size === leads.length}
                  onCheckedChange={(on) => setSelected(on === true ? new Set(leads.map((l) => l.id)) : new Set())}
                />
                {t("selectAll")}
              </label>
              <Button onClick={addSelected} disabled={adding || selectedLeads.length === 0}>
                {adding ? <Loader2 className="animate-spin" /> : <UserPlus />}
                {adding ? t("adding") : t("addSelected", { count: selectedLeads.length })}
              </Button>
            </div>
          </div>

          <ul className="divide-y overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
            {leads.map((lead) => (
              <LeadRow
                key={lead.id}
                lead={lead}
                checked={selected.has(lead.id)}
                onCheckedChange={(on) => {
                  const next = new Set(selected);
                  if (on) next.add(lead.id);
                  else next.delete(lead.id);
                  setSelected(next);
                }}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function LeadRow({
  lead,
  checked,
  onCheckedChange,
}: {
  lead: Lead;
  checked: boolean;
  onCheckedChange: (on: boolean) => void;
}) {
  const t = useTranslations("leads");
  return (
    <li className="flex items-start gap-3 px-4 py-3.5">
      <Checkbox className="mt-1" checked={checked} onCheckedChange={(on) => onCheckedChange(on === true)} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{lead.name || t("unknownName")}</p>
        <p className="truncate text-sm text-muted-foreground">
          {[lead.jobTitle, lead.company].filter(Boolean).join(" · ")}
        </p>
        {lead.location && <p className="truncate text-xs text-muted-foreground">{lead.location}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-3 text-xs">
        {lead.website && (
          <a
            href={toUrl(lead.website)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            {t("website")}
            <ExternalLink className="size-3" />
          </a>
        )}
        {lead.linkedin && (
          <a
            href={toUrl(lead.linkedin)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            LinkedIn
            <ExternalLink className="size-3" />
          </a>
        )}
      </div>
    </li>
  );
}
