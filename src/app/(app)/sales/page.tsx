import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { factStatus } from "@/lib/brain/facts";
import { loadBrand, loadDocuments } from "@/lib/brain/queries";
import { getReadyContext } from "@/lib/context";
import { isAiConfigured } from "@/lib/engine/openai";
import { getCredits, isLeadsConfigured } from "@/lib/leads/explorium";
import { listEmailCampaigns, listOpportunities } from "@/lib/sales/queries";
import { createClient } from "@/lib/supabase/server";
import { SalesWorkspace } from "./sales-workspace";

// Writing a campaign can take up to a minute; allow Server Actions on this page up to 5.
export const maxDuration = 300;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("sales");
  return { title: t("title") };
}

export default async function SalesPage() {
  const ctx = await getReadyContext();
  if (!ctx) return null;
  if (!ctx.activeBrand) redirect("/brain");
  const brandId = ctx.activeBrand.id;

  const supabase = await createClient();
  const leadsConfigured = isLeadsConfigured();
  const [opportunities, campaigns, brand, documents, credits] = await Promise.all([
    listOpportunities(supabase, brandId),
    listEmailCampaigns(supabase, brandId),
    loadBrand(supabase, brandId),
    loadDocuments(supabase, brandId),
    leadsConfigured ? getCredits().catch(() => null) : null,
  ]);
  if (!brand) redirect("/brain");

  const t = await getTranslations("sales");

  return (
    <div>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <SalesWorkspace
        opportunities={opportunities}
        campaigns={campaigns}
        leadsConfigured={leadsConfigured}
        credits={credits}
        status={factStatus(brand, documents.length)}
        defaultLanguage={brand.content_language}
        aiConfigured={isAiConfigured()}
      />
    </div>
  );
}
