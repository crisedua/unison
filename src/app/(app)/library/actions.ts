"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getReadyContext } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";

const idSchema = z.uuid();

export async function deleteGeneration(id: string): Promise<{ ok: boolean }> {
  const ctx = await getReadyContext();
  if (!ctx || !idSchema.safeParse(id).success) return { ok: false };

  const supabase = await createClient();
  const { error } = await supabase.from("unison_generations").delete().eq("id", id).eq("workspace_id", ctx.workspaceId);
  if (error) {
    console.error("[deleteGeneration]", error.message);
    return { ok: false };
  }
  revalidatePath("/library");
  // Email campaigns are also listed on the Sales page.
  revalidatePath("/sales");
  return { ok: true };
}

const draftSchema = z.object({
  title: z.string().trim().min(1).max(300),
  body: z.string().max(100_000),
});

export async function updateDraft(id: string, input: { title: string; body: string }): Promise<{ ok: boolean }> {
  const ctx = await getReadyContext();
  const parsed = draftSchema.safeParse(input);
  if (!ctx || !parsed.success || !idSchema.safeParse(id).success) return { ok: false };

  const supabase = await createClient();
  const { error } = await supabase
    .from("unison_drafts")
    .update(parsed.data)
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId);
  if (error) {
    console.error("[updateDraft]", error.message);
    return { ok: false };
  }
  revalidatePath("/library");
  revalidatePath(`/drafts/${id}`);
  return { ok: true };
}

export async function deleteDraft(id: string): Promise<{ ok: boolean }> {
  const ctx = await getReadyContext();
  if (!ctx || !idSchema.safeParse(id).success) return { ok: false };

  const supabase = await createClient();
  const { error } = await supabase.from("unison_drafts").delete().eq("id", id).eq("workspace_id", ctx.workspaceId);
  if (error) {
    console.error("[deleteDraft]", error.message);
    return { ok: false };
  }
  revalidatePath("/library");
  return { ok: true };
}
