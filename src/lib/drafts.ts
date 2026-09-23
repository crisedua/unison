// What a draft can come from: a content asset, a campaign channel piece or a sales output.
import { CHANNELS } from "@/lib/campaigns/schema";
import { ASSET_TYPES } from "@/lib/engine/assets";
import { SALES_OUTPUTS } from "@/lib/sales/schema";

export const DRAFT_TYPES: readonly string[] = [...new Set<string>([...ASSET_TYPES, ...CHANNELS, ...SALES_OUTPUTS])];

export function isDraftType(value: unknown): value is string {
  return typeof value === "string" && DRAFT_TYPES.includes(value);
}
