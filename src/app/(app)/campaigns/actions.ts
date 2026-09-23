"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { missingFacts } from "@/lib/brain/facts";
import { loadBrainContext } from "@/lib/brain/queries";
import { loadCampaign, loadCampaignGenerations } from "@/lib/campaigns/queries";
import {
  CAMPAIGN_GOALS,
  CAMPAIGN_STATUSES,
  campaignMetricsSchema,
  CHANNELS,
  parseMetrics,
  parseStoredBrief,
  parseStoredReadout,
  type CampaignBrief,
  type CampaignMetrics,
  type Readout,
} from "@/lib/campaigns/schema";
import { compareVariants, type Comparison } from "@/lib/campaigns/stats";
import { getReadyContext } from "@/lib/context";
import {
  CAMPAIGN_REQUIRED_FACTS,
  compileCampaignBrief,
  compileReadout,
  READOUT_REQUIRED_FACTS,
} from "@/lib/engine/campaign";
import type { CompileError } from "@/lib/engine/run";
import { CONTENT_LANGUAGES } from "@/lib/languages";
import { createClient } from "@/lib/supabase/server";

type ActionError = CompileError | { code: "invalid_input" | "not_ready" | "not_found" | "save_failed" };

const idSchema = z.uuid();

/** A campaign the caller can reach (RLS decides), plus the ready context. */
async function campaignContext(id: string) {
  const ctx = await getReadyContext();
  if (!ctx || !idSchema.safeParse(id).success) return null;
  const supabase = await createClient();
  const campaign = await loadCampaign(supabase, id);
  return campaign ? { ctx, supabase, campaign } : null;
}

// ---------------------------------------------------------------------------
// Plan a campaign (Campaign Studio)
// ---------------------------------------------------------------------------

const planSchema = z.object({
  goal: z.enum(CAMPAIGN_GOALS),
  offer: z.string().max(1000),
  audience: z.string().max(1000),
  channels: z.array(z.enum(CHANNELS)).min(1).max(CHANNELS.length),
  durationDays: z.union([z.literal(7), z.literal(14), z.literal(28)]),
  budget: z.string().max(200),
  language: z.enum(CONTENT_LANGUAGES),
});

export type PlanInput = z.input<typeof planSchema>;
export type PlanResult = { ok: true; campaignId: string } | { ok: false; error: ActionError };

export async function planCampaign(raw: PlanInput): Promise<PlanResult> {
  const ctx = await getReadyContext();
  if (!ctx?.activeBrand) return { ok: false, error: { code: "not_ready" } };

  const parsed = planSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: { code: "invalid_input" } };
  const input = { ...parsed.data, channels: CHANNELS.filter((c) => parsed.data.channels.includes(c)) };
  if (input.goal === "custom" && !input.offer.trim()) return { ok: false, error: { code: "invalid_input" } };

  const supabase = await createClient();
  const brain = await loadBrainContext(supabase, ctx.activeBrand.id);
  if (!brain) return { ok: false, error: { code: "not_ready" } };

  const missing = missingFacts(brain.status, CAMPAIGN_REQUIRED_FACTS);
  if (missing.length > 0) return { ok: false, error: { code: "missing_facts", missing } };

  const result = await compileCampaignBrief({ brand: brain.brand, documents: brain.documents, input });
  if (!result.ok) return result;

  const factsUsed = [...new Set(result.output.facts_used)].filter((key) => brain.status[key]);
  const brief: CampaignBrief = { ...result.output, facts_used: factsUsed };
  const { variant_a: a, variant_b: b } = brief.ab_test;

  const { data: campaign, error: campaignError } = await supabase
    .from("unison_campaigns")
    .insert({
      brand_id: brain.brand.id,
      workspace_id: ctx.workspaceId,
      name: brief.title.slice(0, 200) || "Campaign",
      goal: input.goal,
      variant_a: `${a.angle}: ${a.headline}`.slice(0, 500),
      variant_b: `${b.angle}: ${b.headline}`.slice(0, 500),
      conversion_label: brief.ab_test.metric.slice(0, 120),
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (campaignError || !campaign) {
    console.error("[planCampaign] could not save campaign:", campaignError?.message);
    return { ok: false, error: { code: "save_failed" } };
  }

  const { error: generationError } = await supabase.from("unison_generations").insert({
    brand_id: brain.brand.id,
    workspace_id: ctx.workspaceId,
    studio: "campaign",
    campaign_id: campaign.id,
    title: brief.title.slice(0, 200) || "Campaign",
    input,
    output: brief,
    facts_used: factsUsed,
    language: input.language,
    model: result.model,
    input_tokens: result.usage.inputTokens,
    cached_tokens: result.usage.cachedTokens,
    output_tokens: result.usage.outputTokens,
    created_by: ctx.userId,
  });
  if (generationError) {
    console.error("[planCampaign] could not save brief:", generationError.message);
    await supabase.from("unison_campaigns").delete().eq("id", campaign.id);
    return { ok: false, error: { code: "save_failed" } };
  }

  revalidatePath("/campaigns");
  revalidatePath("/library");
  return { ok: true, campaignId: campaign.id as string };
}

// ---------------------------------------------------------------------------
// Campaign details
// ---------------------------------------------------------------------------

const updateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  status: z.enum(CAMPAIGN_STATUSES).optional(),
});

export async function updateCampaign(id: string, raw: z.input<typeof updateSchema>): Promise<{ ok: boolean }> {
  const found = await campaignContext(id);
  const parsed = updateSchema.safeParse(raw);
  if (!found || !parsed.success) return { ok: false };

  const { error } = await found.supabase.from("unison_campaigns").update(parsed.data).eq("id", id);
  if (error) {
    console.error("[updateCampaign]", error.message);
    return { ok: false };
  }
  revalidatePath(`/campaigns/${id}`);
  revalidatePath("/campaigns");
  revalidatePath("/results");
  return { ok: true };
}

export async function deleteCampaign(id: string): Promise<{ ok: boolean }> {
  const found = await campaignContext(id);
  if (!found) return { ok: false };

  const { error } = await found.supabase.from("unison_campaigns").delete().eq("id", id);
  if (error) {
    console.error("[deleteCampaign]", error.message);
    return { ok: false };
  }
  revalidatePath("/campaigns");
  revalidatePath("/results");
  revalidatePath("/library");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Results & analysis
// ---------------------------------------------------------------------------

const resultsSchema = z.object({
  conversionLabel: z.string().trim().max(120),
  variantA: z.string().trim().max(500),
  variantB: z.string().trim().max(500),
  metrics: campaignMetricsSchema,
});

export type SaveResultsResult = { ok: true } | { ok: false; error: "invalid" | "inconsistent" | "failed" };

export async function saveCampaignResults(
  id: string,
  raw: z.input<typeof resultsSchema>,
): Promise<SaveResultsResult> {
  const found = await campaignContext(id);
  if (!found) return { ok: false, error: "failed" };

  const parsed = resultsSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { metrics } = parsed.data;

  // Clicks and results are counted out of the people reached.
  const consistent = [metrics.a, metrics.b].every(
    (v) => v.clicks <= v.reached && v.conversions <= v.reached,
  );
  if (!consistent) return { ok: false, error: "inconsistent" };

  const started = metrics.a.reached > 0 || metrics.b.reached > 0;
  const { error } = await found.supabase
    .from("unison_campaigns")
    .update({
      conversion_label: parsed.data.conversionLabel,
      variant_a: parsed.data.variantA,
      variant_b: parsed.data.variantB,
      metrics,
      ...(started && found.campaign.status === "planned" ? { status: "running" } : {}),
    })
    .eq("id", id);
  if (error) {
    console.error("[saveCampaignResults]", error.message);
    return { ok: false, error: "failed" };
  }

  revalidatePath(`/campaigns/${id}`);
  revalidatePath("/results");
  return { ok: true };
}

const analyzeSchema = z.object({ language: z.enum(CONTENT_LANGUAGES) });

export type AnalyzeResult =
  | { ok: true; generationId: string | null; readout: Readout; comparison: Comparison; metrics: CampaignMetrics }
  | { ok: false; error: ActionError };

/** Writes the read-out for the results saved on the campaign. */
export async function analyzeCampaign(id: string, raw: z.input<typeof analyzeSchema>): Promise<AnalyzeResult> {
  const found = await campaignContext(id);
  const parsed = analyzeSchema.safeParse(raw);
  if (!found) return { ok: false, error: { code: "not_found" } };
  if (!parsed.success) return { ok: false, error: { code: "invalid_input" } };
  const { ctx, supabase, campaign } = found;

  const metrics = parseMetrics(campaign.metrics);
  if (metrics.a.reached === 0 && metrics.b.reached === 0) return { ok: false, error: { code: "invalid_input" } };

  const brain = await loadBrainContext(supabase, campaign.brand_id);
  if (!brain) return { ok: false, error: { code: "not_ready" } };
  const missing = missingFacts(brain.status, READOUT_REQUIRED_FACTS);
  if (missing.length > 0) return { ok: false, error: { code: "missing_facts", missing } };

  const history = await loadCampaignGenerations(supabase, id);
  const briefRow = history.find((g) => g.studio === "campaign");
  const brief = briefRow ? parseStoredBrief(briefRow.output) : null;
  const comparison = compareVariants(metrics.a, metrics.b);

  const result = await compileReadout({
    brand: brain.brand,
    documents: brain.documents,
    input: {
      campaignName: campaign.name,
      successMeasure: brief?.success_measure ?? "",
      variantA: campaign.variant_a,
      variantB: campaign.variant_b,
      conversionLabel: campaign.conversion_label,
      metrics,
      comparison,
      language: parsed.data.language,
    },
  });
  if (!result.ok) return result;

  const factsUsed = [...new Set(result.output.facts_used)].filter((key) => brain.status[key]);
  const readout: Readout = { ...result.output, facts_used: factsUsed };

  const { data, error } = await supabase
    .from("unison_generations")
    .insert({
      brand_id: campaign.brand_id,
      workspace_id: ctx.workspaceId,
      studio: "results",
      campaign_id: id,
      title: readout.headline.slice(0, 200) || campaign.name,
      input: { metrics, comparison, language: parsed.data.language },
      output: readout,
      facts_used: factsUsed,
      language: parsed.data.language,
      model: result.model,
      input_tokens: result.usage.inputTokens,
      cached_tokens: result.usage.cachedTokens,
      output_tokens: result.usage.outputTokens,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error) console.error("[analyzeCampaign] could not save read-out:", error.message);

  revalidatePath(`/campaigns/${id}`);
  revalidatePath("/library");
  return { ok: true, generationId: (data?.id as string | undefined) ?? null, readout, comparison, metrics };
}

/** Saves a read-out's learning as a note in the Company Brain, so future work uses it. */
export async function saveLearningToBrain(generationId: string): Promise<{ ok: boolean }> {
  const ctx = await getReadyContext();
  if (!ctx || !idSchema.safeParse(generationId).success) return { ok: false };

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("unison_generations")
    .select("brand_id, output, campaign_id, created_at")
    .eq("id", generationId)
    .eq("studio", "results")
    .maybeSingle();
  const readout = row ? parseStoredReadout(row.output) : null;
  if (!row || !readout) return { ok: false };

  const campaign = row.campaign_id ? await loadCampaign(supabase, row.campaign_id as string) : null;
  const title = `${campaign?.name ?? readout.headline}`.slice(0, 180);
  const content = [
    readout.learning,
    readout.what_happened,
    `${readout.next_test.hypothesis}`,
    `(${String(row.created_at).slice(0, 10)})`,
  ].join("\n\n");

  const { error } = await supabase.from("unison_brand_documents").insert({
    brand_id: row.brand_id,
    workspace_id: ctx.workspaceId,
    kind: "note",
    title: `✓ ${title}`,
    content,
    created_by: ctx.userId,
  });
  if (error) {
    console.error("[saveLearningToBrain]", error.message);
    return { ok: false };
  }
  revalidatePath("/brain");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Results for a campaign that wasn't planned here
// ---------------------------------------------------------------------------

const manualSchema = z.object({
  name: z.string().trim().min(1).max(200),
  variant_a: z.string().trim().max(500),
  variant_b: z.string().trim().max(500),
  conversion_label: z.string().trim().max(120),
});

export type ManualCampaignState = { error?: "name" | "failed" };

export async function createResultsCampaign(
  _prev: ManualCampaignState,
  formData: FormData,
): Promise<ManualCampaignState> {
  const ctx = await getReadyContext();
  if (!ctx?.activeBrand) return { error: "failed" };

  const parsed = manualSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "name" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("unison_campaigns")
    .insert({
      brand_id: ctx.activeBrand.id,
      workspace_id: ctx.workspaceId,
      goal: "custom",
      status: "running",
      created_by: ctx.userId,
      ...parsed.data,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[createResultsCampaign]", error?.message);
    return { error: "failed" };
  }

  revalidatePath("/results");
  revalidatePath("/campaigns");
  redirect(`/campaigns/${data.id}#results`);
}
