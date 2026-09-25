"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { missingFacts } from "@/lib/brain/facts";
import { loadBrainContext } from "@/lib/brain/queries";
import { getReadyContext } from "@/lib/context";
import type { CompileError } from "@/lib/engine/run";
import { compileLeadFilters, toLeadSearch } from "@/lib/engine/leads";
import { compileEmailCampaign, compileSalesOutput } from "@/lib/engine/sales";
import { CONTENT_LANGUAGES } from "@/lib/languages";
import {
  findEmails,
  getCredits,
  LeadsError,
  searchProspects,
  type Credits,
  type LeadsErrorCode,
} from "@/lib/leads/explorium";
import {
  EMAIL_LOOKUP_MAX,
  hasAnyFilter,
  leadSchema,
  leadSearchSchema,
  type Lead,
  type LeadSearch,
} from "@/lib/leads/schema";
import {
  CAMPAIGN_TYPE,
  campaignInputSchema,
  campaignRequirements,
  MAX_CAMPAIGN_PROSPECTS,
} from "@/lib/sales/campaign";
import { EMAIL_NOT_FOUND_NOTE } from "@/lib/sales/export";
import {
  loadCampaign,
  loadContactInfo,
  loadOpportunitiesByIds,
  loadOpportunity,
  loadOpportunityNotes,
} from "@/lib/sales/queries";
import {
  OPPORTUNITY_STAGES,
  salesRequirements,
  SALES_OUTPUTS,
  type SalesOutput,
  type SalesOutputType,
} from "@/lib/sales/schema";
import { createClient } from "@/lib/supabase/server";

const idSchema = z.uuid();

async function opportunityContext(id: string) {
  const ctx = await getReadyContext();
  if (!ctx || !idSchema.safeParse(id).success) return null;
  const supabase = await createClient();
  const opportunity = await loadOpportunity(supabase, id);
  return opportunity ? { ctx, supabase, opportunity } : null;
}

function revalidateOpportunity(id: string) {
  revalidatePath(`/sales/${id}`);
  revalidatePath("/sales");
}

// ---------------------------------------------------------------------------
// Opportunities
// ---------------------------------------------------------------------------

const detailsSchema = z.object({
  company_name: z.string().trim().min(1).max(200),
  contact_name: z.string().trim().max(200),
  contact_role: z.string().trim().max(200),
  stage: z.enum(OPPORTUNITY_STAGES),
});

export type CreateOpportunityState = { error?: "company" | "failed" };

export async function createOpportunity(
  _prev: CreateOpportunityState,
  formData: FormData,
): Promise<CreateOpportunityState> {
  const ctx = await getReadyContext();
  if (!ctx?.activeBrand) return { error: "failed" };

  const parsed = detailsSchema.safeParse({
    company_name: formData.get("company_name") ?? "",
    contact_name: formData.get("contact_name") ?? "",
    contact_role: formData.get("contact_role") ?? "",
    stage: formData.get("stage") ?? "new",
  });
  if (!parsed.success) return { error: "company" };
  const firstNote = String(formData.get("note") ?? "").trim().slice(0, 20_000);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("unison_opportunities")
    .insert({ ...parsed.data, brand_id: ctx.activeBrand.id, workspace_id: ctx.workspaceId, created_by: ctx.userId })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[createOpportunity]", error?.message);
    return { error: "failed" };
  }

  if (firstNote) {
    await supabase.from("unison_opportunity_notes").insert({
      opportunity_id: data.id,
      workspace_id: ctx.workspaceId,
      content: firstNote,
      created_by: ctx.userId,
    });
  }

  revalidatePath("/sales");
  redirect(`/sales/${data.id}`);
}

export async function updateOpportunity(
  id: string,
  raw: z.input<typeof detailsSchema>,
): Promise<{ ok: boolean }> {
  const found = await opportunityContext(id);
  const parsed = detailsSchema.safeParse(raw);
  if (!found || !parsed.success) return { ok: false };

  const { error } = await found.supabase.from("unison_opportunities").update(parsed.data).eq("id", id);
  if (error) {
    console.error("[updateOpportunity]", error.message);
    return { ok: false };
  }
  revalidateOpportunity(id);
  return { ok: true };
}

export async function deleteOpportunity(id: string): Promise<{ ok: boolean }> {
  const found = await opportunityContext(id);
  if (!found) return { ok: false };

  const { error } = await found.supabase.from("unison_opportunities").delete().eq("id", id);
  if (error) {
    console.error("[deleteOpportunity]", error.message);
    return { ok: false };
  }
  revalidatePath("/sales");
  revalidatePath("/library");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

export async function addOpportunityNote(opportunityId: string, content: string): Promise<{ ok: boolean }> {
  const found = await opportunityContext(opportunityId);
  const text = content.trim();
  if (!found || !text || text.length > 20_000) return { ok: false };

  const { error } = await found.supabase.from("unison_opportunity_notes").insert({
    opportunity_id: opportunityId,
    workspace_id: found.ctx.workspaceId,
    content: text,
    created_by: found.ctx.userId,
  });
  if (error) {
    console.error("[addOpportunityNote]", error.message);
    return { ok: false };
  }
  revalidateOpportunity(opportunityId);
  return { ok: true };
}

export async function deleteOpportunityNote(opportunityId: string, noteId: string): Promise<{ ok: boolean }> {
  const found = await opportunityContext(opportunityId);
  if (!found || !idSchema.safeParse(noteId).success) return { ok: false };

  const { error } = await found.supabase
    .from("unison_opportunity_notes")
    .delete()
    .eq("id", noteId)
    .eq("opportunity_id", opportunityId);
  if (error) {
    console.error("[deleteOpportunityNote]", error.message);
    return { ok: false };
  }
  revalidateOpportunity(opportunityId);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Find leads (Vibe Prospecting / Explorium)
// ---------------------------------------------------------------------------

/** Error for the page: the code to translate, plus Explorium's own answer so failures can be diagnosed. */
function leadsFailure(where: string, error: unknown): { code: LeadsErrorCode; detail?: string } {
  if (error instanceof LeadsError) {
    if (error.code !== "leads_not_configured") console.error(`[${where}]`, error.message);
    return { code: error.code, detail: error.detail?.slice(0, 600) };
  }
  console.error(`[${where}]`, error);
  return { code: "leads_failed", detail: error instanceof Error ? error.message.slice(0, 600) : undefined };
}

export type LeadSearchResult =
  | {
      ok: true;
      leads: Lead[];
      total: number | null;
      industryMatches: string[];
      creditsUsed: number | null;
      credits: Credits | null;
    }
  | { ok: false; error: { code: LeadsErrorCode | "invalid_input" | "need_filter" | "not_ready"; detail?: string } };

export async function searchLeads(raw: z.input<typeof leadSearchSchema>): Promise<LeadSearchResult> {
  const ctx = await getReadyContext();
  if (!ctx?.activeBrand) return { ok: false, error: { code: "not_ready" } };
  const parsed = leadSearchSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: { code: "invalid_input" } };
  if (!hasAnyFilter(parsed.data)) return { ok: false, error: { code: "need_filter" } };

  try {
    const before = await getCredits().catch(() => null);
    const { leads, total, industryMatches } = await searchProspects(parsed.data);
    const after = await getCredits().catch(() => null);
    const creditsUsed = before && after ? Math.max(0, before.remaining - after.remaining) : null;
    return { ok: true, leads, total, industryMatches, creditsUsed, credits: after };
  } catch (error) {
    return { ok: false, error: leadsFailure("searchLeads", error) };
  }
}

export type AiFiltersResult =
  | { ok: true; filters: Omit<LeadSearch, "count">; summary: string }
  | { ok: false; error: CompileError | { code: "invalid_input" | "not_ready" } | { code: "need_filter" } };

/**
 * AI option: turns a plain-language description (or, when empty, the
 * Company Brain) into search filters. Costs an OpenAI call, no Explorium credits.
 */
export async function suggestLeadFilters(request: string): Promise<AiFiltersResult> {
  const ctx = await getReadyContext();
  if (!ctx?.activeBrand) return { ok: false, error: { code: "not_ready" } };
  const text = z.string().max(1000).safeParse(request);
  if (!text.success) return { ok: false, error: { code: "invalid_input" } };

  const supabase = await createClient();
  const brain = await loadBrainContext(supabase, ctx.activeBrand.id);
  if (!brain) return { ok: false, error: { code: "not_ready" } };
  if (!text.data.trim()) {
    // Suggesting from the brain needs to know who the brand sells to.
    const missing = missingFacts(brain.status, ["company", "audience"]);
    if (missing.length > 0) return { ok: false, error: { code: "missing_facts", missing } };
  }

  const result = await compileLeadFilters({ brand: brain.brand, documents: brain.documents, request: text.data });
  if (!result.ok) return result;

  const filters = toLeadSearch(result.output);
  if (!hasAnyFilter({ ...filters, count: 10 })) return { ok: false, error: { code: "need_filter" } };
  return { ok: true, filters, summary: result.output.summary.slice(0, 300) };
}

export type EmailLookupResult =
  | { ok: true; emails: Record<string, string>; credits: Credits | null }
  | { ok: false; error: { code: LeadsErrorCode | "invalid_input" | "not_ready"; detail?: string } };

/** Looks up work emails for the ticked people. Costs credits per person, found or not. */
export async function lookupLeadEmails(ids: string[]): Promise<EmailLookupResult> {
  const ctx = await getReadyContext();
  if (!ctx?.activeBrand) return { ok: false, error: { code: "not_ready" } };
  const parsed = z.array(z.string().regex(/^[a-f0-9]{8,80}$/i)).min(1).max(EMAIL_LOOKUP_MAX).safeParse([...new Set(ids)]);
  if (!parsed.success) return { ok: false, error: { code: "invalid_input" } };

  try {
    const emails = await findEmails(parsed.data);
    const credits = await getCredits().catch(() => null);
    return { ok: true, emails: Object.fromEntries(emails), credits };
  } catch (error) {
    return { ok: false, error: leadsFailure("lookupLeadEmails", error) };
  }
}

export type CampaignEmailsResult =
  | { ok: true; found: number; checked: number; credits: Credits | null }
  | { ok: false; error: { code: LeadsErrorCode | "invalid_input" | "not_found" | "nothing_to_check"; detail?: string } };

/**
 * Looks up work emails for the campaign's prospects that don't have one yet
 * and were never looked up. Each result is saved as a note on the prospect,
 * so nobody is paid for twice. Costs Explorium credits per person.
 */
export async function findCampaignEmails(generationId: string): Promise<CampaignEmailsResult> {
  const ctx = await getReadyContext();
  if (!ctx?.activeBrand || !idSchema.safeParse(generationId).success) return { ok: false, error: { code: "invalid_input" } };
  const supabase = await createClient();
  const row = await loadCampaign(supabase, generationId);
  const input = row ? campaignInputSchema.safeParse(row.input) : null;
  if (!row || !input?.success) return { ok: false, error: { code: "not_found" } };

  const contacts = await loadContactInfo(supabase, input.data.opportunity_ids);
  const pending = Object.entries(contacts)
    .filter(([, c]) => !c.email && !c.emailChecked && c.prospectId)
    .slice(0, EMAIL_LOOKUP_MAX);
  if (pending.length === 0) return { ok: false, error: { code: "nothing_to_check" } };

  let emails: Map<string, string>;
  try {
    emails = await findEmails(pending.map(([, c]) => c.prospectId));
  } catch (error) {
    return { ok: false, error: leadsFailure("findCampaignEmails", error) };
  }

  const notes = pending.map(([opportunityId, c]) => {
    const email = emails.get(c.prospectId);
    return {
      opportunity_id: opportunityId,
      workspace_id: ctx.workspaceId,
      content: email ? `Email: ${email}` : EMAIL_NOT_FOUND_NOTE,
      created_by: ctx.userId,
    };
  });
  const { error } = await supabase.from("unison_opportunity_notes").insert(notes);
  if (error) console.error("[findCampaignEmails] could not save:", error.message);

  const credits = await getCredits().catch(() => null);
  revalidatePath(`/sales/campaign/${generationId}`);
  return { ok: true, found: emails.size, checked: pending.length, credits };
}

const dedupeKey = (company: string, contact: string) => `${company.trim().toLowerCase()}|${contact.trim().toLowerCase()}`;

/** The first note on an opportunity created from a lead: where it came from and how to reach them. */
function leadNote(lead: Lead) {
  return [
    lead.email && `Email: ${lead.email}`,
    lead.linkedin && `LinkedIn: ${lead.linkedin}`,
    lead.website && `Website: ${lead.website}`,
    lead.location && `Location: ${lead.location}`,
    `Source: Vibe Prospecting (Explorium), prospect ${lead.id}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export type AddLeadsResult =
  | { ok: true; added: number; skipped: number; ids: string[] }
  | { ok: false; error: "add_failed" | "invalid_input" };

/** Turns the ticked leads into opportunities, skipping people already in Sales for this brand. */
export async function addLeadsAsOpportunities(raw: unknown): Promise<AddLeadsResult> {
  const ctx = await getReadyContext();
  const parsed = z.array(leadSchema).min(1).max(50).safeParse(raw);
  if (!ctx?.activeBrand || !parsed.success) return { ok: false, error: "invalid_input" };
  const brandId = ctx.activeBrand.id;
  const supabase = await createClient();

  const { data: existing, error: loadError } = await supabase
    .from("unison_opportunities")
    .select("company_name, contact_name")
    .eq("brand_id", brandId)
    .limit(2000);
  if (loadError) {
    console.error("[addLeadsAsOpportunities]", loadError.message);
    return { ok: false, error: "add_failed" };
  }
  const seen = new Set((existing ?? []).map((o) => dedupeKey(o.company_name, o.contact_name)));

  const byKey = new Map<string, Lead>();
  for (const lead of parsed.data) {
    const company = (lead.company || lead.name).trim();
    if (!company) continue;
    const key = dedupeKey(company, lead.name);
    if (seen.has(key) || byKey.has(key)) continue;
    byKey.set(key, { ...lead, company });
  }
  if (byKey.size === 0) return { ok: true, added: 0, skipped: parsed.data.length, ids: [] };

  const rows = [...byKey.values()].map((lead) => ({
    company_name: lead.company,
    contact_name: lead.name,
    contact_role: lead.jobTitle,
    stage: "new" as const,
    brand_id: brandId,
    workspace_id: ctx.workspaceId,
    created_by: ctx.userId,
  }));
  const { data, error } = await supabase
    .from("unison_opportunities")
    .insert(rows)
    .select("id, company_name, contact_name");
  if (error || !data) {
    console.error("[addLeadsAsOpportunities]", error?.message);
    return { ok: false, error: "add_failed" };
  }

  const notes = data.flatMap((row) => {
    const lead = byKey.get(dedupeKey(row.company_name, row.contact_name));
    return lead
      ? [{ opportunity_id: row.id, workspace_id: ctx.workspaceId, content: leadNote(lead), created_by: ctx.userId }]
      : [];
  });
  if (notes.length) {
    const { error: noteError } = await supabase.from("unison_opportunity_notes").insert(notes);
    if (noteError) console.error("[addLeadsAsOpportunities] notes:", noteError.message);
  }

  revalidatePath("/sales");
  return {
    ok: true,
    added: data.length,
    skipped: parsed.data.length - data.length,
    ids: data.map((row) => row.id as string),
  };
}

// ---------------------------------------------------------------------------
// Email campaign for a group of prospects
// ---------------------------------------------------------------------------

const campaignRequestSchema = z.object({
  opportunityIds: z.array(z.uuid()).min(1).max(MAX_CAMPAIGN_PROSPECTS),
  language: z.enum(CONTENT_LANGUAGES),
  focus: z.string().max(500),
});

export type CampaignResult =
  | { ok: true; generationId: string }
  | { ok: false; error: CompileError | { code: "invalid_input" | "not_found" | "save_failed" } };

/** One 3-email sequence for every selected prospect, saved once and shown per person. */
export async function writeEmailCampaign(raw: z.input<typeof campaignRequestSchema>): Promise<CampaignResult> {
  const ctx = await getReadyContext();
  const parsed = campaignRequestSchema.safeParse(raw);
  if (!ctx?.activeBrand) return { ok: false, error: { code: "not_found" } };
  if (!parsed.success) return { ok: false, error: { code: "invalid_input" } };
  const { opportunityIds, language, focus } = parsed.data;
  const brandId = ctx.activeBrand.id;
  const supabase = await createClient();

  const [prospects, brain] = await Promise.all([
    loadOpportunitiesByIds(supabase, brandId, [...new Set(opportunityIds)]),
    loadBrainContext(supabase, brandId),
  ]);
  if (!brain || prospects.length === 0) return { ok: false, error: { code: "not_found" } };

  const missing = missingFacts(brain.status, campaignRequirements);
  if (missing.length > 0) return { ok: false, error: { code: "missing_facts", missing } };

  const result = await compileEmailCampaign({
    brand: brain.brand,
    documents: brain.documents,
    prospects,
    focus,
    language,
  });
  if (!result.ok) return result;

  const factsUsed = [...new Set(result.output.facts_used)].filter((key) => brain.status[key]);
  const output = { ...result.output, facts_used: factsUsed };

  const { data, error } = await supabase
    .from("unison_generations")
    .insert({
      brand_id: brandId,
      workspace_id: ctx.workspaceId,
      studio: "sales",
      opportunity_id: null,
      title: output.title.slice(0, 200) || `Email campaign (${prospects.length})`,
      input: { type: CAMPAIGN_TYPE, language, focus, opportunity_ids: prospects.map((p) => p.id) },
      output,
      facts_used: factsUsed,
      language,
      model: result.model,
      input_tokens: result.usage.inputTokens,
      cached_tokens: result.usage.cachedTokens,
      output_tokens: result.usage.outputTokens,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[writeEmailCampaign] could not save:", error?.message);
    return { ok: false, error: { code: "save_failed" } };
  }

  revalidatePath("/sales");
  revalidatePath("/library");
  for (const p of prospects) revalidatePath(`/sales/${p.id}`);
  return { ok: true, generationId: data.id as string };
}

// ---------------------------------------------------------------------------
// Sales outputs
// ---------------------------------------------------------------------------

const generateSchema = z.object({
  type: z.enum(SALES_OUTPUTS),
  language: z.enum(CONTENT_LANGUAGES),
  focus: z.string().max(500),
});

type SalesError = CompileError | { code: "invalid_input" | "not_found" | "needs_notes" };

export type SalesResult =
  | { ok: true; generationId: string | null; type: SalesOutputType; output: SalesOutput[SalesOutputType] }
  | { ok: false; error: SalesError };

export async function generateSalesOutput(
  opportunityId: string,
  raw: z.input<typeof generateSchema>,
): Promise<SalesResult> {
  const found = await opportunityContext(opportunityId);
  const parsed = generateSchema.safeParse(raw);
  if (!found) return { ok: false, error: { code: "not_found" } };
  if (!parsed.success) return { ok: false, error: { code: "invalid_input" } };
  const { ctx, supabase, opportunity } = found;
  const { type, language, focus } = parsed.data;

  const [brain, notes] = await Promise.all([
    loadBrainContext(supabase, opportunity.brand_id),
    loadOpportunityNotes(supabase, opportunityId),
  ]);
  if (!brain) return { ok: false, error: { code: "not_found" } };

  const missing = missingFacts(brain.status, salesRequirements[type]);
  if (missing.length > 0) return { ok: false, error: { code: "missing_facts", missing } };
  if (type === "call_follow_up" && notes.length === 0) return { ok: false, error: { code: "needs_notes" } };

  const result = await compileSalesOutput({
    brand: brain.brand,
    documents: brain.documents,
    opportunity,
    notes,
    type,
    focus,
    language,
  });
  if (!result.ok) return result;

  const factsUsed = [...new Set(result.output.facts_used)].filter((key) => brain.status[key]);
  const output = { ...result.output, facts_used: factsUsed };

  const { data, error } = await supabase
    .from("unison_generations")
    .insert({
      brand_id: opportunity.brand_id,
      workspace_id: ctx.workspaceId,
      studio: "sales",
      opportunity_id: opportunityId,
      title: output.title.slice(0, 200) || opportunity.company_name,
      input: { type, language, focus },
      output,
      facts_used: factsUsed,
      language,
      model: result.model,
      input_tokens: result.usage.inputTokens,
      cached_tokens: result.usage.cachedTokens,
      output_tokens: result.usage.outputTokens,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error) console.error("[generateSalesOutput] could not save:", error.message);

  revalidateOpportunity(opportunityId);
  revalidatePath("/library");
  return { ok: true, generationId: (data?.id as string | undefined) ?? null, type, output };
}
