import "server-only";
import type { FactKey } from "@/lib/brain/facts";
import {
  campaignBriefSchema,
  readoutSchema,
  type CampaignBrief,
  type CampaignBriefInput,
  type CampaignGoal,
  type CampaignMetrics,
  type Channel,
  type Readout,
} from "@/lib/campaigns/schema";
import { costPer, rate, sampleNeededPerVariant, type Comparison } from "@/lib/campaigns/stats";
import type { ContentLanguage } from "@/lib/languages";
import type { Brand, BrandDocument } from "@/lib/types";
import { buildBrainBlock, languageLine } from "./prompt";
import { runStructured, type RunResult } from "./run";

export const CAMPAIGN_REQUIRED_FACTS: readonly FactKey[] = ["company", "audience", "offer", "voice"];
export const READOUT_REQUIRED_FACTS: readonly FactKey[] = ["company", "audience"];

const GOAL_PROMPT: Record<CampaignGoal, string> = {
  launch_offer: "Launch a new offer or product.",
  generate_leads: "Generate qualified leads: demo requests, sign-ups or enquiries.",
  win_back: "Win back past customers or inactive users.",
  fill_event: "Fill an event, webinar or workshop.",
  seasonal_promo: "Run a seasonal or time-limited promotion.",
  build_awareness: "Build awareness with the right audience.",
  custom: "A custom goal, described below.",
};

const CHANNEL_PROMPT: Record<Channel, string> = {
  linkedin: "LinkedIn (organic posts)",
  email: "Email to the company's own list",
  instagram: "Instagram (organic posts and Reels)",
  meta_ads: "Meta ads (paid, Facebook and Instagram)",
  tiktok: "TikTok (organic short video)",
  whatsapp: "WhatsApp (broadcast lists and Status, to existing contacts only)",
  blog: "Blog article (SEO)",
};

export function buildCampaignTask(input: CampaignBriefInput): string {
  const promoting = input.offer.trim();
  return [
    "# TASK: CAMPAIGN BRIEF",
    "Plan one campaign a small team can launch this week.",
    `## Goal\n${GOAL_PROMPT[input.goal]}${promoting ? `\nWhat we're promoting: ${promoting}` : ""}`,
    `## Audience\n${input.audience.trim() || "Use the audience from the Company Brain."}`,
    [
      "## Constraints",
      `- Channels (use only these): ${input.channels.map((c) => CHANNEL_PROMPT[c]).join("; ")}`,
      `- Campaign length: ${input.durationDays} days`,
      input.budget.trim()
        ? `- Budget: ${input.budget.trim()}`
        : "- Budget: not given. Keep paid spend modest and say where it matters most.",
      languageLine(input.language),
    ].join("\n"),
    [
      "## What to deliver",
      "- 4 or 5 angles that are genuinely different (not one idea reworded), each grounded in a customer truth from the Company Brain.",
      "- 2 or 3 audience segments, each with the one message it should hear.",
      "- An A/B test of two variants built on two different angles, with the same audience and budget, a clear hypothesis, the metric that decides it and a decision rule. Pick the success measure closest to revenue that the team can count (qualified leads beat clicks).",
      `- A launch plan across the ${input.durationDays} days, step by step, on the chosen channels only.`,
      "- Ready-to-publish copy for every chosen channel, following that channel's conventions and ending with the closing ask. For Meta ads, give a primary text and a headline; for Reels or TikTok, a short script with the hook first.",
    ].join("\n"),
  ].join("\n\n");
}

export async function compileCampaignBrief(args: {
  brand: Brand;
  documents: BrandDocument[];
  input: CampaignBriefInput;
}): Promise<RunResult<CampaignBrief>> {
  const brain = buildBrainBlock(args.brand, args.documents);
  return runStructured<CampaignBrief>({
    brandId: args.brand.id,
    brain,
    task: buildCampaignTask(args.input),
    schema: campaignBriefSchema(args.input.channels),
    schemaName: "campaign_brief",
  });
}

// ---------------------------------------------------------------------------
// Results read-out
// ---------------------------------------------------------------------------

const percent = (value: number | null) => (value === null ? "n/a" : `${(value * 100).toFixed(2)}%`);
const money = (value: number | null) => (value === null ? "n/a" : value.toFixed(2));

export type ReadoutInput = {
  campaignName: string;
  successMeasure: string;
  variantA: string;
  variantB: string;
  conversionLabel: string;
  metrics: CampaignMetrics;
  comparison: Comparison;
  language: ContentLanguage;
};

export function buildReadoutTask(input: ReadoutInput): string {
  const { a, b } = input.metrics;
  const label = input.conversionLabel.trim() || "results";
  const c = input.comparison;
  const needed = sampleNeededPerVariant(c.rateA, c.rateB);

  const verdict =
    c.confidence === "not_enough_data"
      ? "Not enough data to call a winner yet. Say so plainly and don't pick one."
      : c.confidence === "unclear"
        ? `No clear winner: the difference in ${c.metric} could easily be chance (p = ${c.pValue?.toFixed(3)}). Say so plainly and don't pick one.`
        : `Variant ${c.winner?.toUpperCase()} ${c.confidence === "strong" ? "wins" : "is ahead but not yet confirmed"} on ${c.metric} per person reached (p = ${c.pValue?.toFixed(3)}, lift of B over A = ${c.lift === null ? "n/a" : `${(c.lift * 100).toFixed(1)}%`}).`;

  return [
    "# TASK: RESULTS READ-OUT",
    `Explain what this campaign's A/B test shows and what to test next. Campaign: ${input.campaignName}.`,
    input.successMeasure.trim() && `Success measure from the brief: ${input.successMeasure.trim()}`,
    [
      "## What was tested",
      `- Variant A: ${input.variantA.trim() || "(not described)"}`,
      `- Variant B: ${input.variantB.trim() || "(not described)"}`,
    ].join("\n"),
    [
      "## Numbers (as logged by the user)",
      `| | Reached | Clicks | ${label} | Spend | Click rate | ${label} rate | Cost per ${label} |`,
      "|---|---|---|---|---|---|---|---|",
      `| A | ${a.reached} | ${a.clicks} | ${a.conversions} | ${a.spend} | ${percent(rate(a.clicks, a.reached))} | ${percent(rate(a.conversions, a.reached))} | ${money(costPer(a.spend, a.conversions))} |`,
      `| B | ${b.reached} | ${b.clicks} | ${b.conversions} | ${b.spend} | ${percent(rate(b.clicks, b.reached))} | ${percent(rate(b.conversions, b.reached))} | ${money(costPer(b.spend, b.conversions))} |`,
      input.metrics.notes.trim() && `\nUser's notes: ${input.metrics.notes.trim()}`,
    ]
      .filter(Boolean)
      .join("\n"),
    [
      "## Verdict (computed from the numbers — do not contradict it)",
      verdict,
      needed !== null &&
        `To confirm a difference of this size you'd need roughly ${needed.toLocaleString("en-US")} people reached per variant.`,
    ]
      .filter(Boolean)
      .join("\n"),
    [
      "## Settings",
      languageLine(input.language),
      "- Explain it in the audience's terms (what they responded to and why), not in statistics jargon.",
      "- The next test should build on what was learned and change one thing only.",
    ].join("\n"),
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function compileReadout(args: {
  brand: Brand;
  documents: BrandDocument[];
  input: ReadoutInput;
}): Promise<RunResult<Readout>> {
  const brain = buildBrainBlock(args.brand, args.documents);
  return runStructured<Readout>({
    brandId: args.brand.id,
    brain,
    task: buildReadoutTask(args.input),
    schema: readoutSchema,
    schemaName: "results_readout",
  });
}
