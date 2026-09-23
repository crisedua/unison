"use client";

import { NotebookPen, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { CHANNEL_ICONS } from "@/components/campaigns/channel-icons";
import { ASSET_ICONS } from "@/components/content-set/asset-icons";
import { SALES_ICONS } from "@/components/sales/sales-icons";
import { isChannel } from "@/lib/campaigns/schema";
import { ASSET_TYPES, type AssetType } from "@/lib/engine/assets";
import { isSalesOutputType } from "@/lib/sales/schema";

const isAsset = (value: string): value is AssetType => (ASSET_TYPES as readonly string[]).includes(value);

/** Icon and label for a draft's source type (content asset, channel piece or sales output). */
export function useDraftType() {
  const tAssets = useTranslations("studio.assets");
  const tChannels = useTranslations("campaigns.channels");
  const tSales = useTranslations("sales.outputs");

  return (type: string): { icon: LucideIcon; label: string } => {
    if (isAsset(type)) return { icon: ASSET_ICONS[type], label: tAssets(type) };
    if (isChannel(type)) return { icon: CHANNEL_ICONS[type], label: tChannels(type) };
    if (isSalesOutputType(type)) return { icon: SALES_ICONS[type], label: tSales(type) };
    return { icon: NotebookPen, label: "" };
  };
}
