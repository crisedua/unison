import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getReadyContext } from "@/lib/context";
import { campaignInputSchema, parseStoredCampaign } from "@/lib/sales/campaign";
import { loadCampaign, loadOpportunitiesByIds } from "@/lib/sales/queries";
import { createClient } from "@/lib/supabase/server";
import { CampaignView } from "./campaign-view";

async function load(id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const supabase = await createClient();
  const row = await loadCampaign(supabase, id);
  if (!row) return null;
  const input = campaignInputSchema.safeParse(row.input);
  const campaign = parseStoredCampaign(row.output);
  if (!input.success || !campaign) return null;
  return { row, input: input.data, campaign, supabase };
}

export async function generateMetadata({ params }: PageProps<"/sales/campaign/[id]">): Promise<Metadata> {
  const found = await load((await params).id);
  return { title: found?.row.title };
}

export default async function CampaignPage({ params }: PageProps<"/sales/campaign/[id]">) {
  const ctx = await getReadyContext();
  if (!ctx) return null;

  const found = await load((await params).id);
  if (!found) notFound();
  const { row, input, campaign, supabase } = found;
  const prospects = await loadOpportunitiesByIds(supabase, row.brand_id, input.opportunity_ids);

  return (
    <CampaignView
      generationId={row.id}
      title={row.title}
      createdAt={row.created_at}
      language={input.language}
      campaign={campaign}
      prospects={prospects}
    />
  );
}
