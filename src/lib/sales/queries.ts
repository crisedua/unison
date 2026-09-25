import "server-only";
import type { Supabase } from "@/lib/brain/queries";
import type { GenerationRow, Opportunity, OpportunityNote } from "@/lib/types";
import { CAMPAIGN_TYPE } from "./campaign";
import { parseContactNotes, type ContactInfo } from "./export";

const OPPORTUNITY_COLUMNS = "id, brand_id, company_name, contact_name, contact_role, stage, created_at, updated_at";

export async function listOpportunities(supabase: Supabase, brandId: string): Promise<Opportunity[]> {
  const { data, error } = await supabase
    .from("unison_opportunities")
    .select(OPPORTUNITY_COLUMNS)
    .eq("brand_id", brandId)
    .order("updated_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(`Could not load opportunities: ${error.message}`);
  return (data ?? []) as Opportunity[];
}

export async function loadOpportunity(supabase: Supabase, id: string): Promise<Opportunity | null> {
  const { data, error } = await supabase.from("unison_opportunities").select(OPPORTUNITY_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`Could not load opportunity: ${error.message}`);
  return data as Opportunity | null;
}

/** Newest first. */
export async function loadOpportunityNotes(supabase: Supabase, opportunityId: string): Promise<OpportunityNote[]> {
  const { data, error } = await supabase
    .from("unison_opportunity_notes")
    .select("id, content, created_at")
    .eq("opportunity_id", opportunityId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Could not load notes: ${error.message}`);
  return (data ?? []) as OpportunityNote[];
}

/** Opportunities by id, in the order the ids were given. Ids from other brands are dropped. */
export async function loadOpportunitiesByIds(supabase: Supabase, brandId: string, ids: string[]): Promise<Opportunity[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("unison_opportunities")
    .select(OPPORTUNITY_COLUMNS)
    .eq("brand_id", brandId)
    .in("id", ids);
  if (error) throw new Error(`Could not load opportunities: ${error.message}`);
  const byId = new Map((data ?? []).map((row) => [row.id as string, row as Opportunity]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}

const GENERATION_COLUMNS =
  "id, studio, title, input, output, facts_used, language, model, campaign_id, opportunity_id, created_at";

/** Outputs written for one opportunity, plus email campaigns that included it. Newest first. */
export async function loadOpportunityGenerations(supabase: Supabase, opportunityId: string): Promise<GenerationRow[]> {
  const [own, campaigns] = await Promise.all([
    supabase
      .from("unison_generations")
      .select(GENERATION_COLUMNS)
      .eq("opportunity_id", opportunityId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("unison_generations")
      .select(GENERATION_COLUMNS)
      .contains("input", { opportunity_ids: [opportunityId] })
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  if (own.error) throw new Error(`Could not load sales history: ${own.error.message}`);
  if (campaigns.error) throw new Error(`Could not load campaigns: ${campaigns.error.message}`);
  return [...(own.data ?? []), ...(campaigns.data ?? [])]
    .sort((a, b) => (b.created_at as string).localeCompare(a.created_at as string))
    .slice(0, 50) as GenerationRow[];
}

/** Email and prospect id for each opportunity, read from its notes. */
export async function loadContactInfo(
  supabase: Supabase,
  opportunityIds: string[],
): Promise<Record<string, ContactInfo>> {
  if (opportunityIds.length === 0) return {};
  const { data, error } = await supabase
    .from("unison_opportunity_notes")
    .select("opportunity_id, content")
    .in("opportunity_id", opportunityIds)
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) throw new Error(`Could not load contact details: ${error.message}`);
  const byOpportunity = new Map<string, string[]>();
  for (const row of data ?? []) {
    const list = byOpportunity.get(row.opportunity_id as string) ?? [];
    list.push(row.content as string);
    byOpportunity.set(row.opportunity_id as string, list);
  }
  return Object.fromEntries(opportunityIds.map((id) => [id, parseContactNotes(byOpportunity.get(id) ?? [])]));
}

export type CampaignSummary = { id: string; title: string; created_at: string; prospects: number };

/** Group email campaigns for the Sales page, newest first. */
export async function listEmailCampaigns(supabase: Supabase, brandId: string): Promise<CampaignSummary[]> {
  const { data, error } = await supabase
    .from("unison_generations")
    .select("id, title, input, created_at")
    .eq("brand_id", brandId)
    .eq("studio", "sales")
    .is("opportunity_id", null)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(`Could not load campaigns: ${error.message}`);
  return (data ?? []).flatMap((row) => {
    const input = row.input as { type?: unknown; opportunity_ids?: unknown } | null;
    if (input?.type !== CAMPAIGN_TYPE) return [];
    const prospects = Array.isArray(input.opportunity_ids) ? input.opportunity_ids.length : 0;
    return [{ id: row.id as string, title: row.title as string, created_at: row.created_at as string, prospects }];
  });
}

export type CampaignRow = GenerationRow & { brand_id: string };

export async function loadCampaign(supabase: Supabase, id: string): Promise<CampaignRow | null> {
  const { data, error } = await supabase
    .from("unison_generations")
    .select(`brand_id, ${GENERATION_COLUMNS}`)
    .eq("id", id)
    .eq("studio", "sales")
    .maybeSingle();
  if (error) throw new Error(`Could not load campaign: ${error.message}`);
  return data as CampaignRow | null;
}
