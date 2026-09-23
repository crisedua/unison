import {
  BriefcaseBusiness,
  Camera,
  Mail,
  Megaphone,
  MessageCircle,
  Music,
  Newspaper,
  type LucideIcon,
} from "lucide-react";
import type { Channel } from "@/lib/campaigns/schema";

export const CHANNEL_ICONS: Record<Channel, LucideIcon> = {
  linkedin: BriefcaseBusiness,
  email: Mail,
  instagram: Camera,
  meta_ads: Megaphone,
  tiktok: Music,
  whatsapp: MessageCircle,
  blog: Newspaper,
};
