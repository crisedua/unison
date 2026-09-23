// Campaign briefs, logged results and results read-outs. Safe to import from client code.
import { z } from "zod";
import { FACT_KEYS } from "@/lib/brain/facts";
import type { ContentLanguage } from "@/lib/languages";

export const CAMPAIGN_GOALS = [
  "launch_offer",
  "generate_leads",
  "win_back",
  "fill_event",
  "seasonal_promo",
  "build_awareness",
  "custom",
] as const;
export type CampaignGoal = (typeof CAMPAIGN_GOALS)[number];

export const CHANNELS = ["linkedin", "email", "instagram", "meta_ads", "tiktok", "whatsapp", "blog"] as const;
export type Channel = (typeof CHANNELS)[number];
export const DEFAULT_CHANNELS: Channel[] = ["linkedin", "email", "meta_ads"];

export const CAMPAIGN_DURATIONS = [7, 14, 28] as const;
export type CampaignDuration = (typeof CAMPAIGN_DURATIONS)[number];

export const CAMPAIGN_STATUSES = ["planned", "running", "done"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export function isChannel(value: unknown): value is Channel {
  return typeof value === "string" && (CHANNELS as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Campaign brief (what the Campaign Studio writes)
// ---------------------------------------------------------------------------

const variant = z.object({
  angle: z.string().describe("Which angle this variant uses"),
  headline: z.string(),
  message: z.string().describe("The core message in 1–2 sentences"),
});

/** The brief schema, with channels limited to the ones the user picked. */
export function campaignBriefSchema(channels: readonly Channel[]) {
  const channel = z.enum(channels.length > 0 ? channels : CHANNELS);
  return z.object({
    title: z.string().describe("Campaign name, 6 words max, in the output language"),
    summary: z.string().describe("The campaign in 2–3 sentences: who it's for, what it offers, why now"),
    success_measure: z
      .string()
      .describe("The one number that decides success, e.g. qualified demo requests — not clicks or likes"),
    audiences: z
      .array(
        z.object({
          segment: z.string(),
          message: z.string().describe("The one message this segment should hear"),
        }),
      )
      .describe("2 or 3 audience segments"),
    angles: z
      .array(
        z.object({
          name: z.string().describe("Short label, 6 words max"),
          insight: z.string().describe("The customer truth behind this angle"),
          opening_line: z.string().describe("A first line that stops the scroll"),
        }),
      )
      .describe("4 or 5 clearly different angles"),
    ab_test: z.object({
      variant_a: variant,
      variant_b: variant,
      hypothesis: z.string(),
      metric: z.string().describe("What to count to pick the winner"),
      duration_days: z.number().int().min(3).max(60),
      audience_and_budget: z.string().describe("How to keep audience and budget identical for both variants"),
      decision_rule: z.string().describe("When to call a winner, e.g. the minimum results needed first"),
    }),
    launch_plan: z
      .array(
        z.object({
          when: z.string().describe("e.g. Day 1, Days 2–4, Week 2"),
          channel,
          action: z.string(),
        }),
      )
      .describe("Step by step, in order"),
    channel_assets: z
      .array(
        z.object({
          channel,
          title: z.string(),
          copy: z.string().describe("Ready to publish, with its closing ask"),
        }),
      )
      .describe("At least one ready-to-use piece per selected channel"),
    facts_used: z.array(z.enum(FACT_KEYS)),
  });
}

export const storedCampaignBriefSchema = campaignBriefSchema(CHANNELS);
export type CampaignBrief = z.infer<typeof storedCampaignBriefSchema>;

export function parseStoredBrief(value: unknown): CampaignBrief | null {
  const parsed = storedCampaignBriefSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export type CampaignBriefInput = {
  goal: CampaignGoal;
  offer: string;
  audience: string;
  channels: Channel[];
  durationDays: CampaignDuration;
  budget: string;
  language: ContentLanguage;
};

// ---------------------------------------------------------------------------
// Logged results
// ---------------------------------------------------------------------------

const count = z.number().int().min(0).max(1_000_000_000);

export const variantMetricsSchema = z.object({
  reached: count,
  clicks: count,
  conversions: count,
  spend: z.number().min(0).max(1_000_000_000),
});
export type VariantMetrics = z.infer<typeof variantMetricsSchema>;

export const campaignMetricsSchema = z.object({
  a: variantMetricsSchema,
  b: variantMetricsSchema,
  notes: z.string().max(4000),
});
export type CampaignMetrics = z.infer<typeof campaignMetricsSchema>;

const EMPTY_VARIANT: VariantMetrics = { reached: 0, clicks: 0, conversions: 0, spend: 0 };
export const EMPTY_METRICS: CampaignMetrics = { a: EMPTY_VARIANT, b: EMPTY_VARIANT, notes: "" };

export function parseMetrics(value: unknown): CampaignMetrics {
  const parsed = campaignMetricsSchema.safeParse(value);
  return parsed.success ? parsed.data : EMPTY_METRICS;
}

export function hasResults(metrics: CampaignMetrics) {
  return metrics.a.reached > 0 || metrics.b.reached > 0;
}

// ---------------------------------------------------------------------------
// Results read-out (what the AI writes after the numbers are in)
// ---------------------------------------------------------------------------

export const readoutSchema = z.object({
  headline: z.string().describe("One-line verdict in plain language"),
  what_happened: z.string().describe("2–3 sentences with the key numbers"),
  why: z
    .string()
    .describe("The most likely reason, in the audience's terms. A hypothesis, not a certainty"),
  next_test: z.object({
    hypothesis: z.string(),
    variant_a: z.string(),
    variant_b: z.string(),
    metric: z.string(),
    duration_days: z.number().int().min(3).max(60),
  }),
  learning: z.string().describe("One sentence worth remembering for future campaigns"),
  caveats: z.array(z.string()).describe("0 to 3 things that limit how far to trust this"),
  facts_used: z.array(z.enum(FACT_KEYS)),
});
export type Readout = z.infer<typeof readoutSchema>;

export function parseStoredReadout(value: unknown): Readout | null {
  const parsed = readoutSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
