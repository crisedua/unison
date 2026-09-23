import { ClipboardList, Reply, Send, type LucideIcon } from "lucide-react";
import type { SalesOutputType } from "@/lib/sales/schema";

export const SALES_ICONS: Record<SalesOutputType, LucideIcon> = {
  discovery_brief: ClipboardList,
  outreach_sequence: Send,
  call_follow_up: Reply,
};
