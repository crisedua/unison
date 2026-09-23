import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { factStatus, missingFacts } from "@/lib/brain/facts";
import { loadBrand, loadDocuments } from "@/lib/brain/queries";
import { getReadyContext } from "@/lib/context";
import { CAMPAIGN_REQUIRED_FACTS } from "@/lib/engine/campaign";
import { isAiConfigured } from "@/lib/engine/openai";
import { createClient } from "@/lib/supabase/server";
import { CampaignPlanner } from "./campaign-planner";

// A full brief can take a minute or two; allow Server Actions on this page up to 5.
export const maxDuration = 300;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("campaigns");
  return { title: t("newCampaign") };
}

export default async function NewCampaignPage() {
  const ctx = await getReadyContext();
  if (!ctx) return null;
  if (!ctx.activeBrand) redirect("/brain");

  const supabase = await createClient();
  const [brand, documents] = await Promise.all([
    loadBrand(supabase, ctx.activeBrand.id),
    loadDocuments(supabase, ctx.activeBrand.id),
  ]);
  if (!brand) redirect("/brain");

  return (
    <CampaignPlanner
      key={brand.id}
      missing={missingFacts(factStatus(brand, documents.length), CAMPAIGN_REQUIRED_FACTS)}
      defaultLanguage={brand.content_language}
      aiConfigured={isAiConfigured()}
    />
  );
}
