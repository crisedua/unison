import "server-only";
import OpenAI from "openai";
import { z } from "zod";
import type { VisualStyle } from "@/lib/brain/visual";
import type { AssetOutput } from "./assets";
import { getOpenAI, isAiConfigured } from "./openai";
import type { CompileErrorCode } from "./run";

/** The model that draws images. Change it in .env.local — no code change needed. */
export const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-2";
export const IMAGE_QUALITY = z
  .enum(["low", "medium", "high", "xhigh", "max"])
  .catch("medium")
  .parse(process.env.OPENAI_IMAGE_QUALITY);

// 9:16 for Reels; both sides divisible by 16, as the GPT image models require.
export const REEL_IMAGE_SIZE = "864x1536";

type Reel = AssetOutput["instagram_reel"];
export type ImagePrompt = { key: string; prompt: string };

function styleLines(style: VisualStyle) {
  return [
    `Look: ${style.look.trim() || "clean, modern, social-media-native imagery with natural light and a clear focal point"}.`,
    style.colors.trim() && `Brand colors to feature: ${style.colors.trim()}.`,
    style.avoid.trim() && `Avoid: ${style.avoid.trim()}.`,
    "No logos, watermarks, phone frames, app UI or captions other than the text specified. People, if shown, look natural and diverse.",
  ]
    .filter(Boolean)
    .join("\n");
}

/** One prompt for the cover and one per scene, sharing a style so the set looks consistent. */
export function reelImagePrompts(reel: Reel, style: VisualStyle, brandName: string): ImagePrompt[] {
  const shared = styleLines(style);
  const total = reel.scenes.length;

  const cover = [
    `Vertical 9:16 cover image for an Instagram Reel by ${brandName}.`,
    `Headline text, large, bold and highly legible, spelled exactly: "${reel.cover_text.trim()}".`,
    "Place the headline in the middle third; keep the top 10% and bottom 20% free of text so Instagram's interface doesn't cover it.",
    `Scene behind the text: ${reel.scenes[0]?.visual ?? reel.hook}`,
    `The Reel is about: ${reel.hook}`,
    shared,
  ].join("\n");

  const scenes = reel.scenes.map((scene, i) => {
    const text = scene.on_screen_text.trim();
    return {
      key: `scene-${String(i + 1).padStart(2, "0")}`,
      prompt: [
        `Vertical 9:16 frame ${i + 1} of ${total} from an Instagram Reel storyboard by ${brandName}. All frames share one consistent visual style.`,
        `Show: ${scene.visual}`,
        text
          ? `Overlay text, bold and legible, spelled exactly: "${text}". Keep it in the middle third, clear of the top 10% and bottom 20%.`
          : "No text in the image.",
        shared,
      ].join("\n"),
    };
  });

  return [{ key: "cover", prompt: cover }, ...scenes];
}

export type ImageResult = { ok: true; png: Buffer } | { ok: false; error: CompileErrorCode };

export async function generateImage(prompt: string): Promise<ImageResult> {
  if (!isAiConfigured()) return { ok: false, error: "ai_not_configured" };
  try {
    const response = await getOpenAI().images.generate({
      model: IMAGE_MODEL,
      prompt,
      size: REEL_IMAGE_SIZE,
      quality: IMAGE_QUALITY,
      output_format: "png",
      n: 1,
    });
    const b64 = response.data?.[0]?.b64_json;
    if (!b64) return { ok: false, error: "ai_failed" };
    return { ok: true, png: Buffer.from(b64, "base64") };
  } catch (error) {
    if (error instanceof OpenAI.AuthenticationError || error instanceof OpenAI.PermissionDeniedError) {
      return { ok: false, error: "ai_key_invalid" };
    }
    if (error instanceof OpenAI.RateLimitError) {
      return { ok: false, error: error.code === "insufficient_quota" ? "ai_quota" : "ai_rate_limited" };
    }
    if (error instanceof OpenAI.NotFoundError) return { ok: false, error: "ai_model_unavailable" };
    if (error instanceof OpenAI.APIConnectionError) return { ok: false, error: "ai_unreachable" };
    if (error instanceof OpenAI.BadRequestError && /safety|moderation|content_policy/i.test(error.message)) {
      return { ok: false, error: "ai_refused" };
    }
    console.error(`[generateImage:${IMAGE_MODEL}]`, error);
    return { ok: false, error: "ai_failed" };
  }
}
