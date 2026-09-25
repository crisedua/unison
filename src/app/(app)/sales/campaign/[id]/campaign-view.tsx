"use client";

import { ArrowLeft, AtSign, Braces, Download, FileDown, Loader2, Mail, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteGeneration } from "@/app/(app)/library/actions";
import { findCampaignEmails } from "@/app/(app)/sales/actions";
import { CopyButton } from "@/components/draft-actions";
import { downloadText, slugify } from "@/components/content-set/to-markdown";
import { SalesOutputView, useSalesText } from "@/components/sales/sales-output-view";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isContentLanguage } from "@/lib/languages";
import { EMAIL_LOOKUP_CREDITS } from "@/lib/leads/schema";
import { mergeCampaign, TEMPLATE_FIELDS, type EmailCampaign } from "@/lib/sales/campaign";
import {
  contactsToReachCsv,
  downloadFile,
  splitName,
  toHostingerCampaign,
  type ContactInfo,
} from "@/lib/sales/export";
import type { Opportunity } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CampaignEditor } from "./campaign-editor";

type Props = {
  generationId: string;
  title: string;
  createdAt: string;
  language: string;
  campaign: EmailCampaign;
  prospects: Opportunity[];
  contacts: Record<string, ContactInfo>;
  leadsConfigured: boolean;
};

const TEMPLATE = "template";

export function CampaignView({
  generationId,
  title,
  createdAt,
  language,
  campaign,
  prospects,
  contacts,
  leadsConfigured,
}: Props) {
  const t = useTranslations("sales");
  const tCommon = useTranslations("common");
  const tLibrary = useTranslations("library");
  const tLanguages = useTranslations("languages");
  const format = useFormatter();
  const router = useRouter();
  const toText = useSalesText();
  const [shown, setShown] = useState<string>(prospects[0]?.id ?? TEMPLATE);
  const [pending, startTransition] = useTransition();

  const [lookingUp, startLookup] = useTransition();
  const [editing, setEditing] = useState(false);

  const current = prospects.find((p) => p.id === shown);
  const withEmail = prospects.filter((p) => contacts[p.id]?.email);
  const canLookUp = prospects.filter((p) => {
    const c = contacts[p.id];
    return c && !c.email && !c.emailChecked && c.prospectId;
  });
  const hostinger = toHostingerCampaign(campaign, language);
  const fileBase = slugify(title);

  function exportContacts() {
    const rows = withEmail.map((p) => ({
      email: contacts[p.id].email,
      ...splitName(p.contact_name),
      company: p.company_name,
      jobTitle: p.contact_role,
    }));
    downloadFile(`${fileBase}-contacts.csv`, contactsToReachCsv(rows), "text/csv;charset=utf-8");
  }

  function hostingerText() {
    return hostinger.emails
      .map(
        (email, i) =>
          `${t("campaign.hostinger.emailN", { n: i + 1, day: email.send_on_day })}\n${t("campaign.hostinger.subject")}: ${email.subject}\n\n${email.body}`,
      )
      .join("\n\n----------------------------------------\n\n");
  }

  function lookUpEmails() {
    const count = Math.min(canLookUp.length, 50);
    if (!window.confirm(t("campaign.hostinger.emailConfirm", { count, credits: count * EMAIL_LOOKUP_CREDITS }))) return;
    // The server looks up only as many people as the credit balance covers.
    startLookup(async () => {
      const result = await findCampaignEmails(generationId);
      if (!result.ok) {
        toast.error(t(`campaign.hostinger.errors.${result.error.code}`), { description: result.error.detail });
        return;
      }
      toast.success(t("campaign.hostinger.emailsFound", { found: result.found, total: result.checked }), {
        description: result.left > 0 ? t("campaign.hostinger.emailsLeft", { count: result.left }) : undefined,
      });
      router.refresh();
    });
  }
  const merged = mergeCampaign(campaign, current ?? TEMPLATE_FIELDS);

  function downloadAll() {
    const parts = prospects.map((p) => {
      const who = [p.contact_name, p.contact_role].filter((v) => v.trim()).join(", ");
      const text = toText({ type: "outreach_sequence", output: mergeCampaign(campaign, p) });
      return `# ${p.company_name}${who ? ` — ${who}` : ""}\n\n${text}`;
    });
    downloadText(`${slugify(title)}.md`, parts.join("\n\n---\n\n"));
  }

  function remove() {
    if (!window.confirm(tLibrary("confirmDelete"))) return;
    startTransition(async () => {
      const result = await deleteGeneration(generationId);
      if (!result.ok) {
        toast.error(tCommon("error"));
        return;
      }
      toast.success(tLibrary("deleted"));
      router.push("/sales");
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/sales" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" />
            {t("backToSales")}
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(true)} disabled={editing}>
              <Pencil />
              {t("campaign.edit.button")}
            </Button>
            <Button variant="outline" size="sm" onClick={downloadAll} disabled={prospects.length === 0}>
              <Download />
              {t("campaign.downloadAll")}
            </Button>
            <Button variant="ghost" size="sm" onClick={remove} disabled={pending} className="text-muted-foreground">
              <Trash2 />
              {tLibrary("deleteSet")}
            </Button>
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">{t("campaign.title")}</p>
          <h1 className="text-3xl font-extrabold sm:text-4xl">{title}</h1>
          <p className="text-sm text-muted-foreground">
            {t("campaign.forCount", { count: prospects.length })} ·{" "}
            {format.dateTime(new Date(createdAt), { dateStyle: "medium", timeStyle: "short" })}
            {isContentLanguage(language) && ` · ${tLanguages(language)}`}
          </p>
        </div>
      </div>

      {editing ? (
        <CampaignEditor
          generationId={generationId}
          title={title}
          campaign={campaign}
          onDone={(saved) => {
            setEditing(false);
            if (saved) router.refresh();
          }}
        />
      ) : (
        <>
          <Card className="gap-4 py-5">
            <CardHeader className="gap-1 px-5">
              <CardTitle className="flex items-center gap-2 font-bold">
                <Mail className="size-4 text-primary" />
                {t("campaign.hostinger.title")}
              </CardTitle>
              <p className="text-sm text-muted-foreground">{t("campaign.hostinger.intro")}</p>
            </CardHeader>
            <CardContent className="space-y-5 px-5 text-sm">
              <div className="space-y-2">
                <p className="font-medium">1. {t("campaign.hostinger.step1")}</p>
                <p className="text-muted-foreground">
                  {t("campaign.hostinger.withEmail", { count: withEmail.length, total: prospects.length })}
                </p>
                <div className="flex flex-wrap gap-2">
                  {leadsConfigured && canLookUp.length > 0 && (
                    <Button variant="outline" size="sm" onClick={lookUpEmails} disabled={lookingUp}>
                      {lookingUp ? <Loader2 className="animate-spin" /> : <AtSign />}
                      {lookingUp
                        ? t("campaign.hostinger.findingEmails")
                        : t("campaign.hostinger.findEmails", { count: Math.min(canLookUp.length, 50) })}
                    </Button>
                  )}
                  <Button size="sm" onClick={exportContacts} disabled={withEmail.length === 0}>
                    <FileDown />
                    {t("campaign.hostinger.exportContacts", { count: withEmail.length })}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <p className="font-medium">2. {t("campaign.hostinger.step2")}</p>
                <p className="text-muted-foreground">{t("campaign.hostinger.tagsHelp")}</p>
                <div className="space-y-2">
                  {hostinger.emails.map((email, i) => (
                    <div key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2">
                      <span className="min-w-0 flex-1 truncate">
                        <span className="text-muted-foreground">
                          {t("campaign.hostinger.emailN", { n: i + 1, day: email.send_on_day })}
                        </span>{" "}
                        <span className="font-medium">{email.subject}</span>
                      </span>
                      <div className="flex gap-2">
                        <CopyButton text={email.subject} label={t("campaign.hostinger.copySubject")} />
                        <CopyButton text={email.body} label={t("campaign.hostinger.copyBody")} />
                      </div>
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadFile(`${fileBase}-hostinger.txt`, hostingerText(), "text/plain;charset=utf-8")}
                >
                  <Download />
                  {t("campaign.hostinger.downloadEmails")}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">3. {t("campaign.hostinger.step3")}</p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
            <Card className="gap-3 py-4">
              <CardHeader className="px-4">
                <CardTitle className="font-bold">{t("campaign.prospects")}</CardTitle>
                <p className="text-xs text-muted-foreground">{t("campaign.templateHelp")}</p>
              </CardHeader>
              <CardContent className="px-2">
                <ul className="max-h-[60vh] space-y-0.5 overflow-y-auto">
                  <li>
                    <PickButton active={shown === TEMPLATE} onClick={() => setShown(TEMPLATE)}>
                      <span className="flex items-center gap-2 font-medium">
                        <Braces className="size-3.5" />
                        {t("campaign.template")}
                      </span>
                    </PickButton>
                  </li>
                  {prospects.map((p) => (
                    <li key={p.id}>
                      <PickButton active={shown === p.id} onClick={() => setShown(p.id)}>
                        <span className="block truncate font-medium">{p.contact_name || p.company_name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[p.contact_role, p.contact_name && p.company_name].filter(Boolean).join(" · ")}
                        </span>
                        <span className="block truncate text-xs">
                          {contacts[p.id]?.email ||
                            (contacts[p.id]?.emailChecked ? t("campaign.hostinger.noEmail") : t("campaign.hostinger.emailUnknown"))}
                        </span>
                      </PickButton>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <div className="min-w-0 space-y-3">
              {current && (
                <p className="text-sm text-muted-foreground">
                  <Link href={`/sales/${current.id}`} className="font-medium text-foreground underline underline-offset-2">
                    {current.company_name}
                  </Link>
                  {current.contact_name && ` · ${current.contact_name}`}
                </p>
              )}
              <SalesOutputView
                key={`${shown}-${title}`}
                item={{ type: "outreach_sequence", output: merged }}
                generationId={generationId}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function PickButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active || undefined}
      className={cn(
        "w-full rounded-md px-3 py-2 text-left text-sm transition-colors",
        active ? "bg-accent text-accent-foreground" : "hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}
