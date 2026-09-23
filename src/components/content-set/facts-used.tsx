"use client";

import { Brain } from "lucide-react";
import { useTranslations } from "next-intl";
import type { FactKey } from "@/lib/brain/facts";

export function FactsUsed({ facts }: { facts: FactKey[] }) {
  const t = useTranslations("result");
  const tFacts = useTranslations("facts");

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className="flex items-center gap-1 font-medium text-muted-foreground">
        <Brain className="size-3.5" />
        {t("factsUsed")}
      </span>
      {facts.length === 0 ? (
        <span className="text-muted-foreground">{t("noFacts")}</span>
      ) : (
        facts.map((fact) => (
          <span key={fact} className="rounded-full bg-accent px-2 py-0.5 font-medium text-accent-foreground">
            {tFacts(fact)}
          </span>
        ))
      )}
    </div>
  );
}
