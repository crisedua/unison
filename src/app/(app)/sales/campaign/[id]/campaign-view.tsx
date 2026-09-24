"use client";

import { ArrowLeft, Braces, Download, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteGeneration } from "@/app/(app)/library/actions";
import { downloadText, slugify } from "@/components/content-set/to-markdown";
import { SalesOutputView, useSalesText } from "@/components/sales/sales-output-view";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isContentLanguage } from "@/lib/languages";
import { mergeCampaign, TEMPLATE_FIELDS, type EmailCampaign } from "@/lib/sales/campaign";
import type { Opportunity } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  generationId: string;
  title: string;
  createdAt: string;
  language: string;
  campaign: EmailCampaign;
  prospects: Opportunity[];
};

const TEMPLATE = "template";

export function CampaignView({ generationId, title, createdAt, language, campaign, prospects }: Props) {
  const t = useTranslations("sales");
  const tCommon = useTranslations("common");
  const tLibrary = useTranslations("library");
  const tLanguages = useTranslations("languages");
  const format = useFormatter();
  const router = useRouter();
  const toText = useSalesText();
  const [shown, setShown] = useState<string>(prospects[0]?.id ?? TEMPLATE);
  const [pending, startTransition] = useTransition();

  const current = prospects.find((p) => p.id === shown);
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
            key={shown}
            item={{ type: "outreach_sequence", output: merged }}
            generationId={generationId}
          />
        </div>
      </div>
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
