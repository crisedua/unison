import type { CampaignStatus } from "@/lib/campaigns/schema";
import { cn } from "@/lib/utils";

const STYLES: Record<CampaignStatus, string> = {
  planned: "bg-muted text-muted-foreground",
  running: "bg-primary/10 text-primary",
  done: "bg-accent text-accent-foreground",
};

export function StatusBadge({ status, label }: { status: CampaignStatus; label: string }) {
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", STYLES[status])}>{label}</span>
  );
}
