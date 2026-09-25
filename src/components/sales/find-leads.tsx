"use client";

import { AtSign, Brain, ExternalLink, FileDown, Loader2, Search, Sparkles, TriangleAlert, UserPlus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  addLeadsAsOpportunities,
  lookupLeadEmails,
  searchLeads,
  suggestLeadFilters,
  type AiFiltersResult,
  type LeadSearchResult,
} from "@/app/(app)/sales/actions";
import { ActionError, AiMissingAlert } from "@/components/action-error";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Credits } from "@/lib/leads/explorium";
import {
  COMPANY_SIZES,
  EMAIL_LOOKUP_CREDITS,
  EMAIL_LOOKUP_MAX,
  JOB_LEVELS,
  LEAD_COUNTRIES,
  leadsToCsv,
  RESULT_COUNTS,
  toUrl,
  type Lead,
  type LeadSearch,
} from "@/lib/leads/schema";

function downloadCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

type Props = {
  configured: boolean;
  aiConfigured: boolean;
  credits: Credits | null;
  /** Called with the ids of the opportunities that were just created. */
  onAdded: (ids: string[]) => void;
};

const EMPTY: LeadSearch = {
  jobTitles: "",
  jobLevels: [],
  industry: "",
  companySizes: [],
  country: "",
  count: 25,
};

function toggle<T>(list: T[], value: T, on: boolean) {
  return on ? [...new Set([...list, value])] : list.filter((v) => v !== value);
}

export function FindLeads({ configured, aiConfigured, credits: initialCredits, onAdded }: Props) {
  const t = useTranslations("leads");
  const locale = useLocale();

  const [search, setSearch] = useState<LeadSearch>(EMPTY);
  const [result, setResult] = useState<LeadSearchResult | null>(null);
  const [credits, setCredits] = useState(initialCredits);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Ids already looked up (found or not), so nobody is paid for twice.
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [searching, startSearch] = useTransition();
  const [adding, startAdd] = useTransition();
  const [lookingUp, startLookup] = useTransition();
  const [aiRequest, setAiRequest] = useState("");
  const [aiSummary, setAiSummary] = useState("");
  const [aiError, setAiError] = useState<Extract<AiFiltersResult, { ok: false }>["error"] | null>(null);
  const [thinking, startThinking] = useTransition();

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
  const toLookUp = selectedLeads.filter((lead) => !checked.has(lead.id)).slice(0, EMAIL_LOOKUP_MAX);

  function lookUpEmails() {
    if (toLookUp.length === 0) return;
    const cost = toLookUp.length * EMAIL_LOOKUP_CREDITS;
    if (!window.confirm(t("emailConfirm", { count: toLookUp.length, credits: cost }))) return;
    const ids = toLookUp.map((lead) => lead.id);
    startLookup(async () => {
      const outcome = await lookupLeadEmails(ids);
      if (!outcome.ok) {
        toast.error(t(`errors.${outcome.error.code}`), { description: outcome.error.detail });
        return;
      }
      setChecked((prev) => new Set([...prev, ...ids]));
      setResult((prev) =>
        prev?.ok
          ? { ...prev, leads: prev.leads.map((lead) => ({ ...lead, email: outcome.emails[lead.id] ?? lead.email })) }
          : prev,
      );
      if (outcome.credits) setCredits(outcome.credits);
      toast.success(t("emailsFound", { found: Object.keys(outcome.emails).length, total: ids.length }));
    });
  }

  function exportCsv() {
    const rows = selectedLeads.length > 0 ? selectedLeads : leads;
    downloadCsv(`prospects-${new Date().toISOString().slice(0, 10)}.csv`, leadsToCsv(rows));
  }

  async function search_(values: LeadSearch) {
    const next = await searchLeads(values);
    setResult(next);
    if (next.ok) {
      setSelected(new Set(next.leads.map((lead) => lead.id)));
      if (next.credits) setCredits(next.credits);
    }
  }

  function runSearch(event: React.FormEvent) {
    event.preventDefault();
    setAiSummary("");
    startSearch(() => search_(search));
  }

  /** AI option: fill the filters from a description (or the Company Brain), then search. */
  function askAi(request: string) {
    startThinking(async () => {
      setAiError(null);
      try {
        const outcome = await suggestLeadFilters(request);
        if (!outcome.ok) {
          setAiError(outcome.error);
          return;
        }
        const values = { ...outcome.filters, count: search.count };
        setSearch(values);
        setAiSummary(outcome.summary);
        if (configured) startSearch(() => search_(values));
      } catch {
        setAiError({ code: "ai_failed" });
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
      // Drop the people that were added so the list shows what's left to review.
      const addedIds = new Set(selectedLeads.map((lead) => lead.id));
      setResult((prev) => (prev?.ok ? { ...prev, leads: prev.leads.filter((lead) => !addedIds.has(lead.id)) } : prev));
      setSelected(new Set());
      onAdded(outcome.ids);
    });
  }

  return (
    <div className="space-y-4">
      {!configured && (
        <Alert className="border-warning-foreground/20 bg-warning text-warning-foreground">
          <TriangleAlert />
          <AlertTitle>{t("notConfiguredTitle")}</AlertTitle>
          <AlertDescription className="text-warning-foreground/90">{t("notConfiguredBody")}</AlertDescription>
        </Alert>
      )}

      <Card className="border-primary/30 bg-accent/40">
        <CardContent className="space-y-3 pt-6">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <Label htmlFor="lead-ai" className="font-semibold">
              {t("aiLabel")}
            </Label>
          </div>
          {!aiConfigured && <AiMissingAlert />}
          <Textarea
            id="lead-ai"
            value={aiRequest}
            maxLength={1000}
            placeholder={t("aiPlaceholder")}
            onChange={(e) => setAiRequest(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && aiRequest.trim()) askAi(aiRequest);
            }}
            className="min-h-20 bg-card"
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">{t("aiHelp")}</p>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => askAi("")}
                disabled={!aiConfigured || thinking || searching}
              >
                <Brain />
                {t("aiFromBrain")}
              </Button>
              <Button
                type="button"
                onClick={() => askAi(aiRequest)}
                disabled={!aiConfigured || thinking || searching || !aiRequest.trim()}
              >
                {thinking ? <Loader2 className="animate-spin" /> : <Sparkles />}
                {thinking ? t("aiThinking") : t("aiFind")}
              </Button>
            </div>
          </div>
          {aiError &&
            (aiError.code === "need_filter" ? (
              <p className="text-sm text-destructive" role="alert">
                {t("aiNoFilters")}
              </p>
            ) : (
              <ActionError error={aiError} />
            ))}
          {aiSummary && !aiError && (
            <p className="text-sm">
              <span className="font-medium">{t("aiUnderstood")}</span> {aiSummary}
            </p>
          )}
        </CardContent>
      </Card>

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
                <p className="text-xs text-muted-foreground">{t("industryHelp")}</p>
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

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
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
          {result.error.detail && (
            <AlertDescription>
              <p className="text-xs">{t("errorDetail")}</p>
              <code className="mt-1 block text-xs break-all whitespace-pre-wrap">{result.error.detail}</code>
            </AlertDescription>
          )}
        </Alert>
      )}

      {result?.ok && result.industryMatches.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {t("industryMatched", { industries: result.industryMatches.join(", ") })}
        </p>
      )}

      {result?.ok && leads.length === 0 && (
        <p className="rounded-xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
          {t("noResults")}
        </p>
      )}

      {result?.ok && leads.length > 0 && (
        <section className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-bold">{t("results", { count: leads.length })}</h3>
              <p className="text-sm text-muted-foreground">
                {t("resultsHint")}
                {result.creditsUsed !== null && ` ${t("used", { count: result.creditsUsed })}`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="mr-1 flex items-center gap-2 text-sm">
                <Checkbox
                  checked={selected.size === leads.length}
                  onCheckedChange={(on) => setSelected(on === true ? new Set(leads.map((l) => l.id)) : new Set())}
                />
                {t("selectAll")}
              </label>
              <Button variant="outline" onClick={lookUpEmails} disabled={lookingUp || toLookUp.length === 0}>
                {lookingUp ? <Loader2 className="animate-spin" /> : <AtSign />}
                {lookingUp ? t("findingEmails") : t("findEmails", { count: toLookUp.length })}
              </Button>
              <Button variant="outline" onClick={exportCsv}>
                <FileDown />
                {t("exportCsv")}
              </Button>
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
                emailChecked={checked.has(lead.id)}
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
  emailChecked,
  checked,
  onCheckedChange,
}: {
  lead: Lead;
  emailChecked: boolean;
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
        {lead.email ? (
          <p className="text-sm break-all">{lead.email}</p>
        ) : (
          emailChecked && <p className="text-xs text-muted-foreground">{t("noEmail")}</p>
        )}
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
