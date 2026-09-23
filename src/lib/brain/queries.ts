import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { Brand, BrandDocument } from "@/lib/types";
import { factStatus } from "./facts";

export type Supabase = Awaited<ReturnType<typeof createClient>>;

/** The brand, its notes and documents, and which facts are filled in. */
export async function loadBrainContext(supabase: Supabase, brandId: string) {
  const [brand, documents] = await Promise.all([loadBrand(supabase, brandId), loadDocuments(supabase, brandId)]);
  if (!brand) return null;
  return { brand, documents, status: factStatus(brand, documents.length) };
}

const BRAND_COLUMNS =
  "id, workspace_id, name, content_language, company, audience, problem, positioning, offer, proof, voice_tone, voice_use, voice_avoid, voice_example, updated_at";

export async function loadBrand(supabase: Supabase, brandId: string): Promise<Brand | null> {
  const { data, error } = await supabase.from("unison_brands").select(BRAND_COLUMNS).eq("id", brandId).maybeSingle();
  if (error) throw new Error(`Could not load brand: ${error.message}`);
  return data as Brand | null;
}

/** Newest first. */
export async function loadDocuments(supabase: Supabase, brandId: string): Promise<BrandDocument[]> {
  const { data, error } = await supabase
    .from("unison_brand_documents")
    .select("id, kind, title, content, file_name, truncated, created_at")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Could not load documents: ${error.message}`);
  return (data ?? []) as BrandDocument[];
}
