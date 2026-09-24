import { Clapperboard, Mail, Megaphone, MessageSquareText, Newspaper, ThumbsUp, Video, type LucideIcon } from "lucide-react";
import type { AssetType } from "@/lib/engine/assets";

export const ASSET_ICONS: Record<AssetType, LucideIcon> = {
  blog_post: Newspaper,
  email: Mail,
  linkedin_post: MessageSquareText,
  facebook_post: ThumbsUp,
  short_script: Video,
  instagram_reel: Clapperboard,
  meta_ad: Megaphone,
};
