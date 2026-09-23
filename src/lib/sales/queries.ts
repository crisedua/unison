import "server-only";
import type { Supabase } from "@/lib/brain/queries";
import type { GenerationRow, Opportunity, OpportunityNote } from "@/lib/types";

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

export async function loadOpportunityGenerations(supabase: Supabase, opportunityId: string): Promise<GenerationRow[]> {
  const { data, error } = await supabase
    .from("unison_generations")
    .select("id, studio, title, input, output, facts_used, language, model, campaign_id, opportunity_id, created_at")
    .eq("opportunity_id", opportunityId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(`Could not load sales history: ${error.message}`);
  return (data ?? []) as GenerationRow[];
}
