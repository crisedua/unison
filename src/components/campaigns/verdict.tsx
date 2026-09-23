"use client";

import { CircleHelp, Trophy, TrendingUp } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { Comparison } from "@/lib/campaigns/stats";
import { cn } from "@/lib/utils";

/** How much better the winner did, relative to the other variant. */
function winnerLift(c: Comparison) {
  if (!c.winner || c.rateA === null || c.rateB === null) return null;
  const [winning, losing] = c.winner === "b" ? [c.rateB, c.rateA] : [c.rateA, c.rateB];
  return losing > 0 ? (winning - losing) / losing : null;
}

/** The computed A/B verdict in plain words. `compact` drops the explanation line. */
export function Verdict({ comparison, compact = false }: { comparison: Comparison; compact?: boolean }) {
  const t = useTranslations("results");
  const format = useFormatter();
  const { confidence, winner, metric } = comparison;
  const lift = winnerLift(comparison);

  const Icon = confidence === "strong" ? Trophy : confidence === "leaning" ? TrendingUp : CircleHelp;
  const title = t(`verdict.${confidence}`, { winner: winner?.toUpperCase() ?? "" });
  const detail =
    confidence === "strong" || confidence === "leaning"
      ? lift !== null && metric
        ? t(`verdictDetail.${confidence}`, {
            lift: t("liftHigher", { value: format.number(lift, { style: "percent", maximumFractionDigits: 0 }) }),
            metric: t(`metricNames.${metric}`),
          })
        : null
      : t(`verdictDetail.${confidence}`);

  return (
    <div
      className={cn(
        "flex items-start gap-2.5",
        !compact && "rounded-lg p-3.5",
        !compact && (confidence === "strong" ? "bg-accent text-accent-foreground" : "bg-muted"),
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 size-4 shrink-0",
          confidence === "strong" || confidence === "leaning" ? "text-primary" : "text-muted-foreground",
        )}
      />
      <div className="min-w-0">
        <p className={cn("font-semibold", compact && "text-sm")}>{title}</p>
        {!compact && detail && <p className="mt-0.5 text-sm opacity-90">{detail}</p>}
      </div>
    </div>
  );
}
