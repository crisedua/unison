"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { BRAIN_FIELD_MAX_LENGTH } from "@/lib/brain/facts";
import { isMissingColumn, VISUAL_FIELD_MAX_LENGTH } from "@/lib/brain/visual";
import { ACTIVE_BRAND_COOKIE, getReadyContext } from "@/lib/context";
import { extractDocumentText, MAX_DOCUMENT_CHARS, MAX_UPLOAD_BYTES } from "@/lib/documents/extract";
import { CONTENT_LANGUAGES, DEFAULT_CONTENT_LANGUAGE } from "@/lib/languages";
import { createClient } from "@/lib/supabase/server";

const nameSchema = z.string().trim().min(1).max(80);
const languageSchema = z.enum(CONTENT_LANGUAGES);

/** The brand must be one of the caller's own brands. */
async function contextForBrand(brandId: string) {
  const ctx = await getReadyContext();
  return ctx?.brands.some((brand) => brand.id === brandId) ? ctx : null;
}

// ---------------------------------------------------------------------------
// Brands
// ---------------------------------------------------------------------------

export type CreateBrandState = { error?: "name" | "failed" };

export async function createBrand(_prev: CreateBrandState, formData: FormData): Promise<CreateBrandState> {
  const ctx = await getReadyContext();
  if (!ctx) return { error: "failed" };

  const name = nameSchema.safeParse(formData.get("name"));
  if (!name.success) return { error: "name" };
  const language = languageSchema.catch(DEFAULT_CONTENT_LANGUAGE).parse(formData.get("content_language"));

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("unison_brands")
    .insert({ workspace_id: ctx.workspaceId, name: name.data, content_language: language })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[createBrand]", error?.message);
    return { error: "failed" };
  }

  (await cookies()).set(ACTIVE_BRAND_COOKIE, data.id, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: true,
  });
  revalidatePath("/", "layout");
  redirect("/brain");
}

// ---------------------------------------------------------------------------
// Company Brain
// ---------------------------------------------------------------------------

const field = z.string().max(BRAIN_FIELD_MAX_LENGTH);

const brainSchema = z.object({
  name: nameSchema,
  content_language: languageSchema,
  company: field,
  audience: field,
  problem: field,
  positioning: field,
  offer: field,
  proof: field,
  voice_tone: field,
  voice_use: field,
  voice_avoid: field,
  voice_example: field,
});

export type BrainFormValues = z.input<typeof brainSchema>;
export type SaveResult = { ok: true } | { ok: false; error: "invalid" | "failed" };

export async function saveBrain(brandId: string, values: BrainFormValues): Promise<SaveResult> {
  if (!(await contextForBrand(brandId))) return { ok: false, error: "failed" };

  const parsed = brainSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const supabase = await createClient();
  const { error } = await supabase.from("unison_brands").update(parsed.data).eq("id", brandId);
  if (error) {
    console.error("[saveBrain]", error.message);
    return { ok: false, error: "failed" };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

const visualSchema = z.object({
  colors: z.string().trim().max(VISUAL_FIELD_MAX_LENGTH),
  look: z.string().trim().max(VISUAL_FIELD_MAX_LENGTH),
  avoid: z.string().trim().max(VISUAL_FIELD_MAX_LENGTH),
});

export type VisualSaveResult = { ok: true } | { ok: false; error: "invalid" | "failed" | "needs_update" };

/** Saves the brand's visual style, used by every generated image. */
export async function saveVisualStyle(brandId: string, values: z.input<typeof visualSchema>): Promise<VisualSaveResult> {
  if (!(await contextForBrand(brandId))) return { ok: false, error: "failed" };
  const parsed = visualSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("unison_brands")
    .update({ visual_colors: parsed.data.colors, visual_look: parsed.data.look, visual_avoid: parsed.data.avoid })
    .eq("id", brandId);
  if (isMissingColumn(error)) return { ok: false, error: "needs_update" };
  if (error) {
    console.error("[saveVisualStyle]", error.message);
    return { ok: false, error: "failed" };
  }
  revalidatePath("/brain");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Notes & documents
// ---------------------------------------------------------------------------

const noteSchema = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(MAX_DOCUMENT_CHARS),
});

export type DocumentResult =
  | { ok: true; name: string; truncated: boolean }
  | {
      ok: false;
      error: "note_invalid" | "save_failed" | "too_large" | "unsupported" | "no_text" | "failed";
    };

export async function addNote(brandId: string, input: { title: string; content: string }): Promise<DocumentResult> {
  const ctx = await contextForBrand(brandId);
  if (!ctx) return { ok: false, error: "save_failed" };

  const note = noteSchema.safeParse(input);
  if (!note.success) return { ok: false, error: "note_invalid" };

  const supabase = await createClient();
  const { error } = await supabase.from("unison_brand_documents").insert({
    brand_id: brandId,
    workspace_id: ctx.workspaceId,
    kind: "note",
    title: note.data.title,
    content: note.data.content,
    created_by: ctx.userId,
  });
  if (error) {
    console.error("[addNote]", error.message);
    return { ok: false, error: "save_failed" };
  }

  revalidatePath("/brain");
  return { ok: true, name: note.data.title, truncated: false };
}

export async function uploadDocument(brandId: string, formData: FormData): Promise<DocumentResult> {
  const ctx = await contextForBrand(brandId);
  if (!ctx) return { ok: false, error: "save_failed" };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "failed" };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: "too_large" };

  const extracted = await extractDocumentText(file);
  if (!extracted.ok) return { ok: false, error: extracted.error };

  const title = (file.name.replace(/\.[^.]+$/, "") || file.name).slice(0, 200);
  const supabase = await createClient();
  const { error } = await supabase.from("unison_brand_documents").insert({
    brand_id: brandId,
    workspace_id: ctx.workspaceId,
    kind: "file",
    title,
    content: extracted.text,
    file_name: file.name.slice(0, 255),
    truncated: extracted.truncated,
    created_by: ctx.userId,
  });
  if (error) {
    console.error("[uploadDocument]", error.message);
    return { ok: false, error: "save_failed" };
  }

  revalidatePath("/brain");
  return { ok: true, name: file.name, truncated: extracted.truncated };
}

export async function deleteDocument(documentId: string): Promise<{ ok: boolean }> {
  const ctx = await getReadyContext();
  if (!ctx) return { ok: false };

  const supabase = await createClient();
  const { error } = await supabase
    .from("unison_brand_documents")
    .delete()
    .eq("id", documentId)
    .eq("workspace_id", ctx.workspaceId);
  if (error) {
    console.error("[deleteDocument]", error.message);
    return { ok: false };
  }

  revalidatePath("/brain");
  return { ok: true };
}
