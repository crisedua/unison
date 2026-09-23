import "server-only";
import type { Supabase } from "@/lib/brain/queries";
import type { Campaign, GenerationRow } from "@/lib/types";

const CAMPAIGN_COLUMNS =
  "id, brand_id, name, goal, status, variant_a, variant_b, conversion_label, metrics, created_at, updated_at";

export async function listCampaigns(supabase: Supabase, brandId: string): Promise<Campaign[]> {
  const { data, error } = await supabase
    .from("unison_campaigns")
    .select(CAMPAIGN_COLUMNS)
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`Could not load campaigns: ${error.message}`);
  return (data ?? []) as Campaign[];
}

export async function loadCampaign(supabase: Supabase, id: string): Promise<Campaign | null> {
  const { data, error } = await supabase.from("unison_campaigns").select(CAMPAIGN_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`Could not load campaign: ${error.message}`);
  return data as Campaign | null;
}

/** Brief and read-outs written for a campaign, newest first. */
export async function loadCampaignGenerations(supabase: Supabase, campaignId: string): Promise<GenerationRow[]> {
  const { data, error } = await supabase
    .from("unison_generations")
    .select("id, studio, title, input, output, facts_used, language, model, campaign_id, opportunity_id, created_at")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Could not load campaign history: ${error.message}`);
  return (data ?? []) as GenerationRow[];
}
