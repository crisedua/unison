// Output types the Content Studio can produce, and the exact shape the model
// must return for each. Adding a new format = one schema + one requirement
// list + one rules entry in prompt.ts. Safe to import from client code.
import { z } from "zod";
import { FACT_KEYS, type FactKey } from "@/lib/brain/facts";
import type { ContentLanguage } from "@/lib/languages";

export const ASSET_TYPES = [
  "blog_post",
  "email",
  "linkedin_post",
  "short_script",
  "instagram_reel",
  "meta_ad",
] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

export const DEFAULT_ASSETS: AssetType[] = ["blog_post", "email", "linkedin_post", "short_script"];

export const LENGTHS = ["short", "standard", "long"] as const;
export type Length = (typeof LENGTHS)[number];

export const TONES = [
  "on_brand",
  "warmer",
  "bolder",
  "more_direct",
  "more_playful",
  "more_formal",
] as const;
export type Tone = (typeof TONES)[number];

// Mapped to Meta's API values when the Meta Ads integration arrives.
export const META_CTAS = [
  "learn_more",
  "sign_up",
  "shop_now",
  "book_now",
  "contact_us",
  "get_offer",
  "get_quote",
  "subscribe",
  "download",
  "apply_now",
  "send_message",
] as const;
export type MetaCta = (typeof META_CTAS)[number];

const scene = z.object({
  visual: z.string().describe("What the viewer sees in this scene"),
  voiceover: z.string().describe("What is said out loud in this scene"),
  on_screen_text: z.string().describe("Text overlay, 7 words max, or an empty string"),
});

const duration = z.number().int().min(5).max(180).describe("Total length in seconds");

const ending = {
  closing_ask: z
    .string()
    .describe("The one action the reader should take, exactly as it appears at the end of the piece"),
  takeaway: z.string().describe("The one idea the reader should leave with, in a single sentence"),
};

export const assetSchemas = {
  blog_post: z.object({
    title: z.string(),
    meta_description: z.string().describe("155 characters max"),
    body_markdown: z.string().describe("The article in Markdown, using ## subheadings, without the title"),
    ...ending,
  }),
  email: z.object({
    subject: z.string().describe("60 characters max"),
    preview_text: z.string().describe("90 characters max"),
    body: z.string().describe("Plain text, short paragraphs separated by blank lines"),
    ...ending,
  }),
  linkedin_post: z.object({
    post: z.string().describe("The full post, line breaks included"),
    ...ending,
  }),
  short_script: z.object({
    title: z.string(),
    duration_seconds: duration,
    hook: z.string().describe("The first line, said in the first 3 seconds"),
    scenes: z.array(scene),
    ...ending,
  }),
  instagram_reel: z.object({
    duration_seconds: duration,
    hook: z.string().describe("What grabs attention in the first 1–2 seconds"),
    cover_text: z.string().describe("Text for the reel cover, 6 words max"),
    scenes: z.array(scene),
    caption: z.string().describe("The post caption, ending with the closing ask"),
    hashtags: z.array(z.string()).describe("3 to 8 hashtags, each starting with #"),
    ...ending,
  }),
  meta_ad: z.object({
    primary_texts: z.array(z.string()).describe("Exactly 3 primary texts, each a different angle"),
    headlines: z.array(z.string()).describe("Exactly 3 headlines, 40 characters max each"),
    description: z.string().describe("30 characters max"),
    cta_button: z.enum(META_CTAS),
    ...ending,
  }),
};

export type AssetOutput = { [K in AssetType]: z.infer<(typeof assetSchemas)[K]> };

/** Facts that must be filled before the engine will write each asset. */
export const assetRequirements: Record<AssetType, readonly FactKey[]> = {
  blog_post: ["company", "audience", "voice"],
  email: ["company", "audience", "voice"],
  linkedin_post: ["company", "audience", "voice"],
  short_script: ["company", "audience", "voice"],
  instagram_reel: ["company", "audience", "voice"],
  meta_ad: ["company", "audience", "offer", "voice"],
};

export function requiredFactsFor(assets: readonly AssetType[]): FactKey[] {
  return FACT_KEYS.filter((key) => assets.some((asset) => assetRequirements[asset].includes(key)));
}

/** Puts a selection into the canonical order and removes duplicates. */
export function normalizeAssets(assets: readonly AssetType[]): AssetType[] {
  return ASSET_TYPES.filter((type) => assets.includes(type));
}

export function contentSetSchema(assets: readonly AssetType[]) {
  const shape = Object.fromEntries(assets.map((asset) => [asset, assetSchemas[asset]]));
  return z.object({
    title: z.string().describe("A short name for this set, 8 words max, in the output language"),
    core_idea: z.string().describe("The single idea every asset carries, in one sentence"),
    facts_used: z
      .array(z.enum(FACT_KEYS))
      .describe("Keys of the Company Brain facts that actually shaped these assets"),
    assets: z.object(shape),
  });
}

export type ContentSetOutput = {
  title: string;
  core_idea: string;
  facts_used: FactKey[];
  assets: Partial<AssetOutput>;
};

/** Reads a saved set back from the database, dropping anything that no longer fits the schema. */
export function parseStoredContentSet(value: unknown): ContentSetOutput | null {
  const base = z
    .object({
      title: z.string(),
      core_idea: z.string().catch(""),
      facts_used: z.array(z.string()).catch([]),
      assets: z.record(z.string(), z.unknown()),
    })
    .safeParse(value);
  if (!base.success) return null;

  const assets: Partial<AssetOutput> = {};
  for (const type of ASSET_TYPES) {
    const parsed = assetSchemas[type].safeParse(base.data.assets[type]);
    if (parsed.success) (assets as Record<AssetType, unknown>)[type] = parsed.data;
  }

  return {
    title: base.data.title,
    core_idea: base.data.core_idea,
    facts_used: base.data.facts_used.filter((key): key is FactKey => (FACT_KEYS as readonly string[]).includes(key)),
    assets,
  };
}

export type ContentSetInput = {
  idea: string;
  sourceDocumentId: string | null;
  assets: AssetType[];
  length: Length;
  tone: Tone;
  customTone: string;
  language: ContentLanguage;
};
