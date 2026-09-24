"use client";

import { Download, Handshake, Loader2, Mail, Phone, Search, UserSearch } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  COMPANY_SIZES,
  COUNTRIES,
  DEPARTMENTS,
  JOB_LEVELS,
  prospectsToCsv,
  RESULT_COUNTS,
  type Prospect,
  type ProspectSearch,
} from "@/lib/prospects/schema";
import { cn } from "@/lib/utils";
import { addProspectsToSales, findContactDetails, findProspects } from "./actions";

const STORAGE_KEY = "unison.prospects";

type Saved = { search: ProspectSearch; prospects: Prospect[]; total: number };

const EMPTY_SEARCH: ProspectSearch = {
  jobLevels: ["director", "manager"],
  departments: ["operations", "finance"],
  countries: ["cl"],
  companySizes: ["201-500", "501-1000", "1001-5000"],
  onlyWithEmail: true,
  count: 25,
  page: 1,
};

function load(): Saved | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

function save(value: Saved) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Private mode or full storage: results just won't survive a reload.
  }
}

function downloadCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Rendered only in the browser (see prospects-client.tsx), so it can restore saved results on first render. */
export function ProspectFinder({ configured }: { configured: boolean }) {
  const t = useTranslations("prospects");
  const locale = useLocale();
  const router = useRouter();
  // The last results of this browser session: they cost credits to fetch.
  const [saved] = useState(load);
  const [search, setSearch] = useState<ProspectSearch>(saved?.search ?? EMPTY_SEARCH);
  const [prospects, setProspects] = useState<Prospect[]>(saved?.prospects ?? []);
  const [total, setTotal] = useState(saved?.total ?? 0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<"search" | "more" | "contacts" | "sales" | null>(null);
  const [, startTransition] = useTransition();

  function update(next: { prospects?: Prospect[]; total?: number; search?: ProspectSearch }) {
    const value = {
      search: next.search ?? search,
      prospects: next.prospects ?? prospects,
      total: next.total ?? total,
    };
    setSearch(value.search);
    setProspects(value.prospects);
    setTotal(value.total);
    save(value);
  }

  const countryName = (code: string) => {
    try {
      return new Intl.DisplayNames([locale], { type: "region" }).of(code.toUpperCase()) ?? code.toUpperCase();
    } catch {
      return code.toUpperCase();
    }
  };

  const chosen = prospects.filter((p) => selected.has(p.id));
  const target = chosen.length > 0 ? chosen : prospects;
  const needContacts = chosen.filter((p) => !p.contactsChecked);

  function toggle<K extends "jobLevels" | "departments" | "countries" | "companySizes">(key: K, value: ProspectSearch[K][number]) {
    setSearch((current) => {
      const list = current[key] as string[];
      const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
      return { ...current, [key]: next };
    });
  }

  function fail(error: string) {
    toast.error(t(`errors.${error}` as "errors.prospecting_failed"));
  }

  function run(page: number) {
    const query = { ...search, page };
    setBusy(page === 1 ? "search" : "more");
    startTransition(async () => {
      try {
        const result = await findProspects(query);
        if (!result.ok) return fail(result.error);
        if (page === 1) {
          setSelected(new Set());
          update({ search: query, prospects: result.prospects, total: result.total });
          if (result.prospects.length === 0) toast.info(t("noResults"));
        } else {
          const known = new Set(prospects.map((p) => p.id));
          update({ search: query, prospects: [...prospects, ...result.prospects.filter((p) => !known.has(p.id))], total: result.total });
        }
      } catch {
        fail("prospecting_failed");
      } finally {
        setBusy(null);
      }
    });
  }

  function getContacts(withPhone: boolean) {
    if (needContacts.length === 0) return toast.info(t("pickForContacts"));
    if (!window.confirm(t("confirmContacts", { count: needContacts.length }))) return;
    setBusy("contacts");
    startTransition(async () => {
      try {
        const result = await findContactDetails(needContacts.map((p) => p.id), withPhone);
        if (!result.ok) return fail(result.error);
        const byId = new Map(result.contacts.map((c) => [c.id, c]));
        update({
          prospects: prospects.map((p) => {
            const c = byId.get(p.id);
            return c ? { ...p, email: c.email || p.email, phone: c.phone || p.phone, contactsChecked: true } : p;
          }),
        });
        toast.success(t("contactsFound", { found: result.contacts.filter((c) => c.email || c.phone).length, total: result.contacts.length }));
      } catch {
        fail("prospecting_failed");
      } finally {
        setBusy(null);
      }
    });
  }

  function exportCsv() {
    if (target.length === 0) return;
    downloadCsv(`prospects-${new Date().toISOString().slice(0, 10)}.csv`, prospectsToCsv(target));
  }

  function addToSales() {
    if (chosen.length === 0) return toast.info(t("pickForSales"));
    setBusy("sales");
    startTransition(async () => {
      try {
        const result = await addProspectsToSales(chosen);
        if (!result.ok) return fail(result.error);
        setSelected(new Set());
        toast.success(t("addedToSales", { count: result.added }), {
          action: { label: t("openSales"), onClick: () => router.push("/sales") },
        });
      } catch {
        fail("save_failed");
      } finally {
        setBusy(null);
      }
    });
  }

  const allSelected = prospects.length > 0 && selected.size === prospects.length;

  return (
    <div className="space-y-6">
      {!configured && (
        <Alert>
          <UserSearch />
          <AlertTitle>{t("notConfiguredTitle")}</AlertTitle>
          <AlertDescription>{t("notConfiguredBody")}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Card className="py-5">
          <CardContent className="space-y-5 px-5">
            <ChipGroup
              label={t("jobLevelLabel")}
              options={JOB_LEVELS}
              selected={search.jobLevels}
              labelFor={(v) => t(`jobLevels.${v}`)}
              onToggle={(v) => toggle("jobLevels", v)}
            />
            <ChipGroup
              label={t("departmentLabel")}
              options={DEPARTMENTS}
              selected={search.departments}
              labelFor={(v) => t(`departments.${v}`)}
              onToggle={(v) => toggle("departments", v)}
            />
            <ChipGroup
              label={t("countryLabel")}
              options={COUNTRIES}
              selected={search.countries}
              labelFor={countryName}
              onToggle={(v) => toggle("countries", v)}
            />
            <ChipGroup
              label={t("companySizeLabel")}
              options={COMPANY_SIZES}
              selected={search.companySizes}
              labelFor={(v) => t("employees", { range: v })}
              onToggle={(v) => toggle("companySizes", v)}
            />

            <div className="flex items-center gap-2">
              <Checkbox
                id="only-email"
                checked={search.onlyWithEmail}
                onCheckedChange={(value) => setSearch((s) => ({ ...s, onlyWithEmail: value === true }))}
              />
              <Label htmlFor="only-email" className="font-normal">
                {t("onlyWithEmail")}
              </Label>
            </div>

            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm font-medium">{t("countLabel")}</legend>
              <div className="grid grid-cols-3 rounded-lg bg-muted p-0.5">
                {RESULT_COUNTS.map((count) => (
                  <button
                    key={count}
                    type="button"
                    aria-pressed={search.count === count}
                    onClick={() => setSearch((s) => ({ ...s, count }))}
                    className={cn(
                      "rounded-md py-1.5 text-sm transition-colors",
                      search.count === count
                        ? "bg-card font-medium text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </fieldset>

            <p className="text-xs text-muted-foreground">{t("creditsNote")}</p>
            <Button className="h-11 w-full text-base" disabled={!configured || busy !== null} onClick={() => run(1)}>
              {busy === "search" ? <Loader2 className="animate-spin" /> : <Search />}
              {busy === "search" ? t("searching") : t("search")}
            </Button>
          </CardContent>
        </Card>

        <div className="min-w-0 space-y-3">
          {prospects.length === 0 ? (
            <div className="flex min-h-80 flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <UserSearch className="size-5" />
              </div>
              <p className="max-w-sm text-sm text-muted-foreground">{t("empty")}</p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  {t("showing", { shown: prospects.length, total })}
                  {selected.size > 0 && ` · ${t("selectedCount", { count: selected.size })}`}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => getContacts(false)}>
                    {busy === "contacts" ? <Loader2 className="animate-spin" /> : <Mail />}
                    {t("getEmails")}
                  </Button>
                  <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => getContacts(true)}>
                    <Phone />
                    {t("getEmailsAndPhones")}
                  </Button>
                  <Button variant="outline" size="sm" disabled={busy !== null} onClick={exportCsv}>
                    <Download />
                    {chosen.length > 0 ? t("exportSelected", { count: chosen.length }) : t("exportAll")}
                  </Button>
                  <Button size="sm" disabled={busy !== null} onClick={addToSales}>
                    {busy === "sales" ? <Loader2 className="animate-spin" /> : <Handshake />}
                    {t("addToSales")}
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="border-b text-xs text-muted-foreground">
                    <tr>
                      <th className="w-10 px-3 py-2.5">
                        <Checkbox
                          aria-label={t("selectAll")}
                          checked={allSelected ? true : selected.size > 0 ? "indeterminate" : false}
                          onCheckedChange={() =>
                            setSelected(allSelected ? new Set() : new Set(prospects.map((p) => p.id)))
                          }
                        />
                      </th>
                      <th className="px-3 py-2.5 font-medium">{t("colPerson")}</th>
                      <th className="px-3 py-2.5 font-medium">{t("colCompany")}</th>
                      <th className="px-3 py-2.5 font-medium">{t("colContact")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {prospects.map((p) => (
                      <tr key={p.id} className={cn(selected.has(p.id) && "bg-accent/40")}>
                        <td className="px-3 py-2.5 align-top">
                          <Checkbox
                            aria-label={p.fullName}
                            checked={selected.has(p.id)}
                            onCheckedChange={() =>
                              setSelected((current) => {
                                const next = new Set(current);
                                if (next.has(p.id)) next.delete(p.id);
                                else next.add(p.id);
                                return next;
                              })
                            }
                          />
                        </td>
                        <td className="px-3 py-2.5 align-top">
                          <p className="font-medium">
                            {p.linkedin ? (
                              <a
                                href={p.linkedin.startsWith("http") ? p.linkedin : `https://${p.linkedin}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:underline"
                              >
                                {p.fullName}
                              </a>
                            ) : (
                              p.fullName
                            )}
                          </p>
                          <p className="text-muted-foreground">{p.jobTitle}</p>
                        </td>
                        <td className="px-3 py-2.5 align-top">
                          <p>{p.companyName}</p>
                          <p className="text-xs text-muted-foreground">
                            {[p.companyWebsite, [p.city, p.country].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}
                          </p>
                        </td>
                        <td className="px-3 py-2.5 align-top">
                          {p.email && <p className="break-all">{p.email}</p>}
                          {p.phone && <p className="text-muted-foreground">{p.phone}</p>}
                          {!p.email && !p.phone && (
                            <p className="text-xs text-muted-foreground">{p.contactsChecked ? t("notFound") : "—"}</p>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {prospects.length < total && (
                <div className="flex justify-center">
                  <Button variant="outline" disabled={busy !== null} onClick={() => run(search.page + 1)}>
                    {busy === "more" && <Loader2 className="animate-spin" />}
                    {t("loadMore", { count: search.count })}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ChipGroup<T extends string>({
  label,
  options,
  selected,
  labelFor,
  onToggle,
}: {
  label: string;
  options: readonly T[];
  selected: readonly T[];
  labelFor: (value: T) => string;
  onToggle: (value: T) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const on = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(option)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs transition-colors",
                on
                  ? "border-primary bg-accent font-medium text-accent-foreground"
                  : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {labelFor(option)}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
