"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { factStatus, missingFacts } from "@/lib/brain/facts";
import { loadBrand, loadDocuments } from "@/lib/brain/queries";
import { getReadyContext } from "@/lib/context";
import {
  ASSET_TYPES,
  LENGTHS,
  normalizeAssets,
  requiredFactsFor,
  TONES,
  type ContentSetOutput,
} from "@/lib/engine/assets";
import { compileContentSet, type CompileError } from "@/lib/engine/compile";
import { isDraftType } from "@/lib/drafts";
import { CONTENT_LANGUAGES } from "@/lib/languages";
import { createClient } from "@/lib/supabase/server";

const inputSchema = z.object({
  idea: z.string().max(6000),
  sourceDocumentId: z.uuid().nullable(),
  assets: z.array(z.enum(ASSET_TYPES)).min(1).max(ASSET_TYPES.length),
  length: z.enum(LENGTHS),
  tone: z.enum(TONES),
  customTone: z.string().max(300),
  language: z.enum(CONTENT_LANGUAGES),
});

export type GenerateInput = z.input<typeof inputSchema>;

export type GenerateError = CompileError | { code: "invalid_input" | "not_ready" };

export type GenerateResult =
  | { ok: true; generationId: string | null; output: ContentSetOutput }
  | { ok: false; error: GenerateError };

/** Writes a content set from the active brand's Company Brain and saves it to the Library. */
export async function generateContentSet(raw: GenerateInput): Promise<GenerateResult> {
  const ctx = await getReadyContext();
  if (!ctx?.activeBrand) return { ok: false, error: { code: "not_ready" } };

  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: { code: "invalid_input" } };
  const input = { ...parsed.data, assets: normalizeAssets(parsed.data.assets) };

  const supabase = await createClient();
  const brand = await loadBrand(supabase, ctx.activeBrand.id);
  if (!brand) return { ok: false, error: { code: "not_ready" } };
  const documents = await loadDocuments(supabase, brand.id);

  // Nothing is written without the facts it needs.
  const status = factStatus(brand, documents.length);
  const missing = missingFacts(status, requiredFactsFor(input.assets));
  if (missing.length > 0) return { ok: false, error: { code: "missing_facts", missing } };

  const source = input.sourceDocumentId
    ? (documents.find((doc) => doc.id === input.sourceDocumentId) ?? null)
    : null;
  if (!input.idea.trim() && !source) return { ok: false, error: { code: "invalid_input" } };

  const result = await compileContentSet({ brand, documents, source, input });
  if (!result.ok) return result;

  // Only report facts that exist and are filled in.
  const factsUsed = [...new Set(result.output.facts_used)].filter((key) => status[key]);
  const output: ContentSetOutput = { ...result.output, facts_used: factsUsed };

  const { data, error } = await supabase
    .from("unison_generations")
    .insert({
      brand_id: brand.id,
      workspace_id: ctx.workspaceId,
      studio: "content",
      title: output.title.slice(0, 200) || "Untitled",
      input,
      output,
      facts_used: factsUsed,
      language: input.language,
      model: result.model,
      input_tokens: result.usage.inputTokens,
      cached_tokens: result.usage.cachedTokens,
      output_tokens: result.usage.outputTokens,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error) console.error("[generateContentSet] could not save the set:", error.message);

  revalidatePath("/library");
  return { ok: true, generationId: data?.id ?? null, output };
}

const draftSchema = z.object({
  generationId: z.uuid().nullable(),
  assetType: z.string().refine(isDraftType),
  title: z.string().trim().min(1).max(300),
  body: z.string().min(1).max(100_000),
});

/** Saves one piece (content asset, campaign channel copy or sales output) as an editable draft. */
export async function saveDraft(raw: z.input<typeof draftSchema>): Promise<{ ok: true; id: string } | { ok: false }> {
  const ctx = await getReadyContext();
  const parsed = draftSchema.safeParse(raw);
  if (!ctx || !parsed.success) return { ok: false };

  const supabase = await createClient();
  let brandId = ctx.activeBrand?.id ?? null;
  if (parsed.data.generationId) {
    const { data } = await supabase
      .from("unison_generations")
      .select("brand_id")
      .eq("id", parsed.data.generationId)
      .maybeSingle();
    brandId = (data?.brand_id as string | undefined) ?? brandId;
  }
  if (!brandId) return { ok: false };

  const { data, error } = await supabase
    .from("unison_drafts")
    .insert({
      brand_id: brandId,
      workspace_id: ctx.workspaceId,
      generation_id: parsed.data.generationId,
      asset_type: parsed.data.assetType,
      title: parsed.data.title,
      body: parsed.data.body,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[saveDraft]", error?.message);
    return { ok: false };
  }

  revalidatePath("/library");
  return { ok: true, id: data.id as string };
}
