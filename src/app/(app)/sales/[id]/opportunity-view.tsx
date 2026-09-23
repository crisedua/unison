"use client";

import { ArrowLeft, Loader2, Pencil, Sparkles, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ActionError, AiMissingAlert, MissingFactsNotice } from "@/components/action-error";
import { SALES_ICONS } from "@/components/sales/sales-icons";
import { SalesOutputView, type AnySalesOutput } from "@/components/sales/sales-output-view";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { missingFacts, type FactKey } from "@/lib/brain/facts";
import { CONTENT_LANGUAGES, isContentLanguage, type ContentLanguage } from "@/lib/languages";
import {
  OPPORTUNITY_STAGES,
  SALES_OUTPUTS,
  salesRequirements,
  type OpportunityStage,
  type SalesOutputType,
} from "@/lib/sales/schema";
import type { Opportunity, OpportunityNote } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  addOpportunityNote,
  deleteOpportunity,
  deleteOpportunityNote,
  generateSalesOutput,
  updateOpportunity,
  type SalesResult,
} from "../actions";

export type HistoryItem = { id: string; createdAt: string; item: AnySalesOutput };

type Details = Pick<Opportunity, "company_name" | "contact_name" | "contact_role" | "stage">;
type Shown = { id: string | null; item: AnySalesOutput };

type Props = {
  opportunity: Opportunity;
  notes: OpportunityNote[];
  history: HistoryItem[];
  status: Record<FactKey, boolean>;
  defaultLanguage: ContentLanguage;
  aiConfigured: boolean;
};

export function OpportunityView({ opportunity, notes, history, status, defaultLanguage, aiConfigured }: Props) {
  const t = useTranslations("sales");
  const tCommon = useTranslations("common");
  const router = useRouter();

  const [details, setDetails] = useState<Details>({
    company_name: opportunity.company_name,
    contact_name: opportunity.contact_name,
    contact_role: opportunity.contact_role,
    stage: opportunity.stage,
  });
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  function saveDetails(next: Details, onDone?: () => void) {
    startTransition(async () => {
      const result = await updateOpportunity(opportunity.id, next);
      if (!result.ok) {
        toast.error(tCommon("error"));
        return;
      }
      setDetails(next);
      onDone?.();
    });
  }

  function changeStage(value: string) {
    const stage = OPPORTUNITY_STAGES.find((s) => s === value);
    if (stage && stage !== details.stage) saveDetails({ ...details, stage });
  }

  function remove() {
    if (!window.confirm(t("confirmDelete"))) return;
    startTransition(async () => {
      const result = await deleteOpportunity(opportunity.id);
      if (!result.ok) {
        toast.error(tCommon("error"));
        return;
      }
      toast.success(t("deleted"));
      router.push("/sales");
    });
  }

  const contact = [details.contact_name, details.contact_role].filter((v) => v.trim()).join(", ");

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/sales" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" />
            {t("backToSales")}
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={details.stage} onValueChange={changeStage} disabled={pending}>
              <SelectTrigger size="sm" className="w-32" aria-label={t("stageLabel")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPPORTUNITY_STAGES.map((stage: OpportunityStage) => (
                  <SelectItem key={stage} value={stage}>
                    {t(`stages.${stage}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil />
              {t("editDetails")}
            </Button>
            <Button variant="ghost" size="sm" onClick={remove} disabled={pending} className="text-muted-foreground">
              <Trash2 />
              {t("deleteOpportunity")}
            </Button>
          </div>
        </div>
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold sm:text-4xl">{details.company_name}</h1>
          {contact && <p className="text-muted-foreground">{contact}</p>}
        </div>
      </div>

      <EditDetailsDialog
        open={editing}
        onOpenChange={setEditing}
        details={details}
        pending={pending}
        onSave={(next) => saveDetails(next, () => {
          setEditing(false);
          toast.success(t("detailsSaved"));
        })}
      />

      {!aiConfigured && <AiMissingAlert />}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <NotesCard opportunityId={opportunity.id} notes={notes} />
        <WritePanel
          opportunityId={opportunity.id}
          hasNotes={notes.length > 0}
          history={history}
          status={status}
          defaultLanguage={defaultLanguage}
          aiConfigured={aiConfigured}
        />
      </div>
    </div>
  );
}

function EditDetailsDialog({
  open,
  onOpenChange,
  details,
  pending,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  details: Details;
  pending: boolean;
  onSave: (details: Details) => void;
}) {
  const t = useTranslations("sales");
  const tCommon = useTranslations("common");
  const [form, setForm] = useState(details);
  const set = (key: "company_name" | "contact_name" | "contact_role") => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setForm(details);
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("editDetails")}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (form.company_name.trim()) onSave({ ...form, stage: details.stage });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="edit-company">{t("companyLabel")}</Label>
            <Input id="edit-company" required maxLength={200} value={form.company_name} onChange={set("company_name")} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-contact">{t("contactLabel")}</Label>
              <Input id="edit-contact" maxLength={200} value={form.contact_name} onChange={set("contact_name")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">{t("roleLabel")}</Label>
              <Input id="edit-role" maxLength={200} value={form.contact_role} onChange={set("contact_role")} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={pending || !form.company_name.trim()}>
              {pending ? tCommon("saving") : tCommon("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NotesCard({ opportunityId, notes }: { opportunityId: string; notes: OpportunityNote[] }) {
  const t = useTranslations("sales");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();

  function add() {
    const content = draft.trim();
    if (!content) return;
    startTransition(async () => {
      const result = await addOpportunityNote(opportunityId, content);
      if (!result.ok) {
        toast.error(tCommon("error"));
        return;
      }
      setDraft("");
      toast.success(t("noteAdded"));
    });
  }

  function remove(noteId: string) {
    if (!window.confirm(t("confirmDeleteNote"))) return;
    startTransition(async () => {
      const result = await deleteOpportunityNote(opportunityId, noteId);
      if (!result.ok) toast.error(tCommon("error"));
    });
  }

  return (
    <Card className="gap-4 py-5">
      <CardHeader className="gap-1 px-5">
        <CardTitle className="font-bold">{t("notesTitle")}</CardTitle>
        <CardDescription>{t("notesHelp")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-5">
        <div className="space-y-2">
          <Textarea
            value={draft}
            maxLength={20000}
            placeholder={t("notePlaceholder")}
            aria-label={t("notesTitle")}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") add();
            }}
            className="min-h-24 bg-card"
          />
          <Button size="sm" onClick={add} disabled={pending || !draft.trim()}>
            {t("addNote")}
          </Button>
        </div>
        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noNotes")}</p>
        ) : (
          <ul className="space-y-3">
            {notes.map((note) => (
              <li key={note.id} className="group rounded-lg border p-3 text-sm">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    {format.dateTime(new Date(note.created_at), { dateStyle: "medium", timeStyle: "short" })}
                  </span>
                  <button
                    type="button"
                    onClick={() => remove(note.id)}
                    disabled={pending}
                    aria-label={tCommon("delete")}
                    className="rounded p-0.5 text-muted-foreground opacity-60 transition-opacity group-hover:opacity-100 hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
                <p className="leading-relaxed whitespace-pre-line">{note.content}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function WritePanel({
  opportunityId,
  hasNotes,
  history,
  status,
  defaultLanguage,
  aiConfigured,
}: {
  opportunityId: string;
  hasNotes: boolean;
  history: HistoryItem[];
  status: Record<FactKey, boolean>;
  defaultLanguage: ContentLanguage;
  aiConfigured: boolean;
}) {
  const t = useTranslations("sales");
  const tErrors = useTranslations("errors");
  const tLanguages = useTranslations("languages");
  const format = useFormatter();

  const [type, setType] = useState<SalesOutputType>("discovery_brief");
  const [focus, setFocus] = useState("");
  const [language, setLanguage] = useState<ContentLanguage>(defaultLanguage);
  const [shown, setShown] = useState<Shown | null>(history[0] ? { id: history[0].id, item: history[0].item } : null);
  const [error, setError] = useState<Extract<SalesResult, { ok: false }>["error"] | null>(null);
  const [pending, startTransition] = useTransition();

  const missing = missingFacts(status, salesRequirements[type]);
  const needsNotes = type === "call_follow_up" && !hasNotes;
  const canGenerate = aiConfigured && missing.length === 0 && !needsNotes && !pending;

  function generate() {
    startTransition(async () => {
      setError(null);
      try {
        const response = await generateSalesOutput(opportunityId, { type, language, focus });
        if (!response.ok) {
          setError(response.error);
          return;
        }
        setShown({ id: response.generationId, item: { type: response.type, output: response.output } as AnySalesOutput });
      } catch {
        setError({ code: "ai_failed" });
      }
    });
  }

  return (
    <div className="min-w-0 space-y-4">
      <Card className="gap-4 py-5">
        <CardHeader className="px-5">
          <CardTitle className="font-bold">{t("writeTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 px-5">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3" role="radiogroup">
            {SALES_OUTPUTS.map((option) => {
              const Icon = SALES_ICONS[option];
              const selected = type === option;
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setType(option)}
                  className={cn(
                    "flex flex-col gap-1 rounded-lg border p-3 text-left text-sm transition-colors",
                    selected ? "border-primary bg-accent text-accent-foreground" : "bg-card hover:bg-muted",
                  )}
                >
                  <span className="flex items-center gap-2 font-medium">
                    <Icon className="size-4 shrink-0" />
                    {t(`outputs.${option}`)}
                  </span>
                  <span className={cn("text-xs", selected ? "text-accent-foreground/80" : "text-muted-foreground")}>
                    {t(`outputHelp.${option}`)}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_14rem]">
            <div className="space-y-2">
              <Label htmlFor="focus">{t("focusLabel")}</Label>
              <Input
                id="focus"
                value={focus}
                maxLength={500}
                placeholder={t("focusPlaceholder")}
                onChange={(e) => setFocus(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sales-language">{t("languageLabel")}</Label>
              <Select value={language} onValueChange={(value) => isContentLanguage(value) && setLanguage(value)}>
                <SelectTrigger id="sales-language" className="w-full">
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
          {needsNotes && <p className="text-sm text-warning-foreground">{tErrors("needs_notes")}</p>}

          <Button className="w-full sm:w-auto" disabled={!canGenerate} onClick={generate}>
            {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {pending ? t("generating") : t("generate")}
          </Button>
        </CardContent>
      </Card>

      {pending ? (
        <Card className="gap-4 py-6">
          <CardContent className="space-y-4 px-6">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Loader2 className="size-4 animate-spin text-primary" />
              {t("generatingHint")}
            </p>
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      ) : error ? (
        <ActionError error={error} />
      ) : shown ? (
        <SalesOutputView key={shown.id ?? "unsaved"} item={shown.item} generationId={shown.id} />
      ) : null}

      <Card className="gap-3 py-4">
        <CardHeader className="px-5">
          <CardTitle className="text-sm font-semibold">{t("history")}</CardTitle>
        </CardHeader>
        <CardContent className="px-2">
          {history.length === 0 ? (
            <p className="px-3 pb-1 text-sm text-muted-foreground">{t("noHistory")}</p>
          ) : (
            <ul>
              {history.map((entry) => {
                const Icon = SALES_ICONS[entry.item.type];
                const active = shown?.id === entry.id;
                return (
                  <li key={entry.id}>
                    <button
                      type="button"
                      aria-current={active || undefined}
                      onClick={() => {
                        setError(null);
                        setShown({ id: entry.id, item: entry.item });
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                        active ? "bg-accent text-accent-foreground" : "hover:bg-muted",
                      )}
                    >
                      <Icon className="size-4 shrink-0 text-primary" />
                      <span className="min-w-0 flex-1 truncate font-medium">{entry.item.output.title}</span>
                      <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                        {t(`outputs.${entry.item.type}`)} ·{" "}
                        {format.dateTime(new Date(entry.createdAt), { dateStyle: "medium", timeStyle: "short" })}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
