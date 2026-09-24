"use client";

import { Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { FactsUsed } from "@/components/content-set/facts-used";
import { downloadText, slugify } from "@/components/content-set/to-markdown";
import { CopyButton, SaveDraftButton } from "@/components/draft-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SalesOutput, SalesOutputType } from "@/lib/sales/schema";

export type AnySalesOutput = {
  [K in SalesOutputType]: { type: K; output: SalesOutput[K] };
}[SalesOutputType];

/** Plain text of an output, for copying, downloading and saving as a draft. */
export function useSalesText() {
  const t = useTranslations("sales");
  const subjectLabel = useTranslations("result")("subject");
  const list = (items: string[]) => items.map((line) => `- ${line}`).join("\n");

  return (item: AnySalesOutput): string => {
    switch (item.type) {
      case "discovery_brief": {
        const o = item.output;
        return [
          `# ${o.title}`,
          `## ${t("context")}\n${o.context}`,
          `## ${t("likelyPains")}\n${list(o.likely_pains)}`,
          `## ${t("questions")}\n${o.questions
            .map((q, i) => `${i + 1}. ${q.question}\n   ${t("valueToExplore")}: ${q.value_to_explore}`)
            .join("\n")}`,
          o.watch_outs.length > 0 ? `## ${t("watchOuts")}\n${list(o.watch_outs)}` : null,
          `## ${t("nextStep")}\n${o.next_step}`,
        ]
          .filter(Boolean)
          .join("\n\n");
      }
      case "outreach_sequence":
        return item.output.emails
          .map((e) => `## ${t("emailDay", { day: e.send_on_day })}\n${subjectLabel}: ${e.subject}\n\n${e.body}`)
          .join("\n\n");
      case "call_follow_up":
        return `${subjectLabel}: ${item.output.subject}\n\n${item.output.body}`;
    }
  };
}

export function SalesOutputView({ item, generationId }: { item: AnySalesOutput; generationId: string | null }) {
  const t = useTranslations("sales");
  const tCommon = useTranslations("common");
  const toText = useSalesText();
  const text = () => toText(item);
  const title = item.output.title;

  return (
    <Card className="gap-5 py-5">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 px-5">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{t(`outputs.${item.type}`)}</p>
          <CardTitle className="mt-0.5 text-lg font-bold">{title}</CardTitle>
        </div>
        <div className="flex flex-wrap gap-2">
          <CopyButton text={text} />
          <Button variant="outline" size="sm" onClick={() => downloadText(`${slugify(title)}.md`, text())}>
            <Download />
            {tCommon("download")}
          </Button>
          <SaveDraftButton generationId={generationId} assetType={item.type} title={title} body={text} />
        </div>
      </CardHeader>
      <CardContent className="space-y-5 px-5 text-sm">
        <Body item={item} />
        <FactsUsed facts={item.output.facts_used} />
      </CardContent>
    </Card>
  );
}

function Body({ item }: { item: AnySalesOutput }) {
  const t = useTranslations("sales");
  const tResult = useTranslations("result");

  switch (item.type) {
    case "discovery_brief": {
      const o = item.output;
      return (
        <>
          <Section title={t("context")}>
            <p className="leading-relaxed">{o.context}</p>
          </Section>
          <Section title={t("likelyPains")}>
            <ul className="list-disc space-y-0.5 pl-5">
              {o.likely_pains.map((pain, i) => (
                <li key={i}>{pain}</li>
              ))}
            </ul>
          </Section>
          <Section title={t("questions")}>
            <ol className="space-y-2.5">
              {o.questions.map((q, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-medium">{q.question}</p>
                    <p className="text-muted-foreground">
                      {t("valueToExplore")}: {q.value_to_explore}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Section>
          {o.watch_outs.length > 0 && (
            <Section title={t("watchOuts")}>
              <ul className="list-disc space-y-0.5 pl-5">
                {o.watch_outs.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </Section>
          )}
          <NextStep text={o.next_step} />
        </>
      );
    }
    case "outreach_sequence":
      return (
        <div className="space-y-3">
          {item.output.emails.map((email, i) => (
            <div key={i} className="space-y-2 rounded-lg border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                  {t("emailDay", { day: email.send_on_day })}
                </span>
                <CopyButton text={`${email.subject}\n\n${email.body}`} />
              </div>
              <p>
                <span className="text-muted-foreground">{tResult("subject")}:</span>{" "}
                <span className="font-semibold">{email.subject}</span>
              </p>
              <p className="leading-relaxed whitespace-pre-line">{email.body}</p>
            </div>
          ))}
        </div>
      );
    case "call_follow_up": {
      const o = item.output;
      return (
        <>
          <div className="space-y-2 rounded-lg border p-4">
            <p>
              <span className="text-muted-foreground">{tResult("subject")}:</span>{" "}
              <span className="font-semibold">{o.subject}</span>
            </p>
            <p className="leading-relaxed whitespace-pre-line">{o.body}</p>
          </div>
          <Section title={t("recap")}>
            <ul className="list-disc space-y-0.5 pl-5">
              {o.recap.map((point, i) => (
                <li key={i}>{point}</li>
              ))}
            </ul>
          </Section>
          <NextStep text={o.next_step} />
        </>
      );
    }
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</p>
      {children}
    </div>
  );
}

function NextStep({ text }: { text: string }) {
  const t = useTranslations("sales");
  return (
    <div className="rounded-lg bg-accent/70 p-3.5">
      <p className="text-xs font-semibold tracking-wide text-accent-foreground uppercase">{t("nextStep")}</p>
      <p className="mt-1">{text}</p>
    </div>
  );
}
