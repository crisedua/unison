import {
  BriefcaseBusiness,
  Camera,
  Mail,
  Megaphone,
  MessageCircle,
  MonitorPlay,
  Music,
  Newspaper,
  Search,
  ThumbsUp,
  type LucideIcon,
} from "lucide-react";
import type { Channel } from "@/lib/campaigns/schema";

export const CHANNEL_ICONS: Record<Channel, LucideIcon> = {
  facebook: ThumbsUp,
  instagram: Camera,
  meta_ads: Megaphone,
  email: Mail,
  linkedin: BriefcaseBusiness,
  tiktok: Music,
  youtube: MonitorPlay,
  google_ads: Search,
  whatsapp: MessageCircle,
  blog: Newspaper,
};
