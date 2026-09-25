"use server";

import { z } from "zod";
import { loadVisualStyle } from "@/lib/brain/visual";
import { getReadyContext } from "@/lib/context";
import { parseStoredContentSet } from "@/lib/engine/assets";
import { generateImage, reelImagePrompts } from "@/lib/engine/images";
import type { CompileErrorCode } from "@/lib/engine/run";
import { listMedia, reelFolder, removeMedia, signMedia, uploadMedia, type SignedMedia } from "@/lib/media/storage";
import { createClient } from "@/lib/supabase/server";

const idSchema = z.uuid();

async function loadReel(generationId: string) {
  const ctx = await getReadyContext();
  if (!ctx || !idSchema.safeParse(generationId).success) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("unison_generations")
    .select("id, brand_id, title, output")
    .eq("id", generationId)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  const set = data ? parseStoredContentSet(data.output) : null;
  const reel = set?.assets.instagram_reel;
  if (!data || !set || !reel) return null;
  const brandName = ctx.brands.find((b) => b.id === data.brand_id)?.name ?? "the brand";
  const folder = reelFolder(ctx.workspaceId, generationId);
  return { ctx, supabase, row: data, set, reel, brandName, folder };
}

export type ReelImagesResult =
  | { ok: true; images: SignedMedia[]; failed: number }
  | { ok: false; error: { code: CompileErrorCode | "not_found" | "save_failed" } };

/** The Reel's saved images (cover first, then scenes), with view and download links. */
export async function getReelImages(generationId: string): Promise<ReelImagesResult> {
  const found = await loadReel(generationId);
  if (!found) return { ok: false, error: { code: "not_found" } };
  const names = await listMedia(found.supabase, found.folder);
  const images = await signMedia(found.supabase, found.folder, names, slug(found.set.title));
  return { ok: true, images, failed: 0 };
}

/**
 * Draws the cover and one image per scene, following the brand's visual style,
 * and replaces any earlier images. Costs one OpenAI image call per picture.
 */
export async function createReelImages(generationId: string): Promise<ReelImagesResult> {
  const found = await loadReel(generationId);
  if (!found) return { ok: false, error: { code: "not_found" } };
  const { supabase, reel, folder, brandName, row } = found;

  const { style } = await loadVisualStyle(supabase, row.brand_id as string);
  const prompts = reelImagePrompts(reel, style, brandName);

  // A few at a time: image calls are slow and rate-limited.
  const saved: string[] = [];
  let firstError: CompileErrorCode | "save_failed" | null = null;
  const queue = [...prompts];
  async function worker() {
    for (let item = queue.shift(); item; item = queue.shift()) {
      const image = await generateImage(item.prompt);
      if (!image.ok) {
        firstError ??= image.error;
        continue;
      }
      try {
        await uploadMedia(supabase, `${folder}/${item.key}.png`, image.png, "image/png");
        saved.push(`${item.key}.png`);
      } catch (error) {
        console.error("[createReelImages]", error);
        firstError ??= "save_failed";
      }
    }
  }
  await Promise.all([worker(), worker(), worker()]);

  if (saved.length === 0) return { ok: false, error: { code: firstError ?? "ai_failed" } };

  // Drop images from an earlier version that this run didn't replace (e.g. fewer scenes now).
  if (saved.length === prompts.length) {
    const keep = new Set(saved);
    const stale = (await listMedia(supabase, folder)).filter((name) => !keep.has(name));
    await removeMedia(supabase, folder, stale);
  }

  const names = await listMedia(supabase, folder);
  const images = await signMedia(supabase, folder, names, slug(found.set.title));
  return { ok: true, images, failed: prompts.length - saved.length };
}

function slug(title: string) {
  return (
    title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50) || "reel"
  );
}
