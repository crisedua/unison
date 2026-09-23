"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { missingFacts } from "@/lib/brain/facts";
import { loadBrainContext } from "@/lib/brain/queries";
import { getReadyContext } from "@/lib/context";
import type { CompileError } from "@/lib/engine/run";
import { compileSalesOutput } from "@/lib/engine/sales";
import { CONTENT_LANGUAGES } from "@/lib/languages";
import { loadOpportunity, loadOpportunityNotes } from "@/lib/sales/queries";
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
