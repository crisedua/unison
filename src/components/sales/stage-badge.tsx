import type { OpportunityStage } from "@/lib/sales/schema";
import { cn } from "@/lib/utils";

const STYLES: Record<OpportunityStage, string> = {
  new: "bg-muted text-muted-foreground",
  contacted: "bg-muted text-foreground",
  meeting: "bg-primary/10 text-primary",
  proposal: "bg-primary/15 text-primary",
  won: "bg-accent text-accent-foreground",
  lost: "bg-destructive/10 text-destructive",
};

export function StageBadge({ stage, label }: { stage: OpportunityStage; label: string }) {
  return (
    <span className={cn("inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", STYLES[stage])}>
      {label}
    </span>
  );
}
