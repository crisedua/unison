import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import type { AnySalesOutput } from "@/components/sales/sales-output-view";
import { factStatus } from "@/lib/brain/facts";
import { loadBrand, loadDocuments } from "@/lib/brain/queries";
import { getReadyContext } from "@/lib/context";
import { isAiConfigured } from "@/lib/engine/openai";
import { CAMPAIGN_TYPE, mergeCampaign, parseStoredCampaign } from "@/lib/sales/campaign";
import { loadOpportunity, loadOpportunityGenerations, loadOpportunityNotes } from "@/lib/sales/queries";
import { isSalesOutputType, parseStoredSales } from "@/lib/sales/schema";
import { createClient } from "@/lib/supabase/server";
import { OpportunityView, type HistoryItem } from "./opportunity-view";

// Writing can take up to a minute; allow Server Actions on this page up to 5.
export const maxDuration = 300;

async function load(id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const supabase = await createClient();
  return loadOpportunity(supabase, id);
}

export async function generateMetadata({ params }: PageProps<"/sales/[id]">): Promise<Metadata> {
  const opportunity = await load((await params).id);
  return { title: opportunity?.company_name };
}

export default async function OpportunityPage({ params }: PageProps<"/sales/[id]">) {
  const ctx = await getReadyContext();
  if (!ctx) return null;

  const opportunity = await load((await params).id);
  if (!opportunity) notFound();

  const supabase = await createClient();
  const [notes, generations, brand, documents] = await Promise.all([
    loadOpportunityNotes(supabase, opportunity.id),
    loadOpportunityGenerations(supabase, opportunity.id),
    loadBrand(supabase, opportunity.brand_id),
    loadDocuments(supabase, opportunity.brand_id),
  ]);
  if (!brand) notFound();

  const history: HistoryItem[] = generations.flatMap((g) => {
    if (g.studio !== "sales") return [];
    const type = g.input?.type;
    // A group email campaign shows here as this person's own outreach emails.
    if (type === CAMPAIGN_TYPE) {
      const campaign = parseStoredCampaign(g.output);
      if (!campaign) return [];
      const output = mergeCampaign(campaign, opportunity);
      return [{ id: g.id, createdAt: g.created_at, item: { type: "outreach_sequence", output } as AnySalesOutput }];
    }
    if (!isSalesOutputType(type)) return [];
    const output = parseStoredSales(type, g.output);
    return output ? [{ id: g.id, createdAt: g.created_at, item: { type, output } as AnySalesOutput }] : [];
  });

  return (
    <OpportunityView
      key={opportunity.id}
      opportunity={opportunity}
      notes={notes}
      history={history}
      status={factStatus(brand, documents.length)}
      defaultLanguage={brand.content_language}
      aiConfigured={isAiConfigured()}
    />
  );
}
