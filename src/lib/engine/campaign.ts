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
  facebook: "Facebook (organic: Page posts, Groups and Facebook Reels)",
  instagram: "Instagram (organic: Reels, carousels and Stories)",
  meta_ads: "Meta ads (paid, Facebook and Instagram)",
  email: "Email marketing to the company's own list",
  linkedin: "LinkedIn (organic posts)",
  tiktok: "TikTok (organic short video)",
  youtube: "YouTube (videos and Shorts)",
  google_ads: "Google Ads (paid search)",
  whatsapp: "WhatsApp (broadcast lists and Status, to existing contacts only)",
  blog: "Blog article (SEO)",
};

// How the ready-to-publish piece for each channel should look.
const CHANNEL_COPY_RULES: Record<Channel, string> = {
  facebook: "a Page post: hook in the first line, short paragraphs, one link and one ask; say which Groups it fits, without spamming them",
  instagram: "a Reel script (hook in the first 2 seconds, scenes, on-screen text) plus its caption and 3 to 8 specific hashtags",
  meta_ads: "3 primary texts on different angles, 3 headlines of 40 characters max and the CTA button; no claims about personal attributes (\"Are you struggling with…?\"), per Meta's ad policies",
  email: "one standalone email with subject and preview text (the full sequence goes in email_program)",
  linkedin: "a post whose first line works alone before \"…see more\"; short lines, at most 3 hashtags at the end",
  tiktok: "a script with the hook in the first 2 seconds, scenes, on-screen text and a caption",
  youtube: "a video title under 70 characters, a description with the ask in the first 2 lines, and a 60-second Shorts script",
  google_ads: "a responsive search ad: 5 headlines of 30 characters max, 2 descriptions of 90 characters max, and 5 to 10 keywords with their match type",
  whatsapp: "a broadcast message under 500 characters that reads like a person wrote it, with one ask",
  blog: "the title, meta description and an outline with the key points under each subheading",
};

const PAID_CHANNELS: readonly Channel[] = ["meta_ads", "google_ads"];

export function buildCampaignTask(input: CampaignBriefInput): string {
  const promoting = input.offer.trim();
  const long = input.durationDays >= 60;
  const paid = input.channels.filter((c) => PAID_CHANNELS.includes(c));
  const hasEmail = input.channels.includes("email");

  return [
    "# TASK: MARKETING PLAN",
    long
      ? "Write a complete marketing plan a small team can start this week and run for the whole period."
      : "Plan one campaign a small team can launch this week, as a complete marketing plan.",
    `## Goal\n${GOAL_PROMPT[input.goal]}${promoting ? `\nWhat we're promoting: ${promoting}` : ""}`,
    `## Audience\n${input.audience.trim() || "Use the audience from the Company Brain."}`,
    [
      "## Constraints",
      `- Channels (use only these): ${input.channels.map((c) => CHANNEL_PROMPT[c]).join("; ")}`,
      `- Length: ${input.durationDays} days`,
      input.budget.trim()
        ? `- Budget: ${input.budget.trim()}`
        : paid.length > 0
          ? "- Budget: not given. Keep paid spend modest, say where it matters most, and phrase amounts as ranges the team can adjust."
          : "- Budget: not given, and no paid channels were chosen. Plan for time, not money.",
      languageLine(input.language),
    ].join("\n"),
    [
      "## What to deliver",
      "- strategy: the positioning sentence for this plan, then the 4 funnel stages (awareness, consideration, conversion, retention), each with its goal, the chosen channels that do the work there and the concrete tactics.",
      "- channel_plans: exactly one per chosen channel, covering its role, targeting, setup, formats, cadence, share of the paid budget and the KPI to watch." +
        (paid.length > 0
          ? " For paid channels, give the campaign objective, the ad sets (cold audience, lookalike or similar, and retargeting of site visitors and engagers), placements and how the budget splits between them. Organic channels get 0% of the budget; paid channels together get 100%."
          : " No paid channels were chosen, so every budget share is 0."),
      hasEmail &&
        "- email_program: how to grow the list during the campaign, the segments, a sequence of 4 to 6 ready-to-send emails spread across the campaign (each with its send day, segment, purpose, subject, preview text, body and one call to action), and 2 or 3 automations worth setting up. Each email does one job and moves the reader one step closer to the goal.",
      "- 4 or 5 angles that are genuinely different (not one idea reworded), each grounded in a customer truth from the Company Brain.",
      "- 2 or 3 audience segments, each with the one message it should hear.",
      "- An A/B test of two variants built on two different angles, with the same audience and budget, a clear hypothesis, the metric that decides it and a decision rule. Pick the success measure closest to revenue that the team can count (qualified leads beat clicks).",
      long
        ? `- A launch plan across the ${input.durationDays} days, week by week (use "Week 1", "Weeks 2–4" and so on), on the chosen channels only.`
        : `- A launch plan across the ${input.durationDays} days, step by step, on the chosen channels only.`,
      "- tracking: 3 to 6 setup steps so the team can measure it: the pixel or tag, the conversion event, UTM links per channel and where to read the numbers.",
      "- Ready-to-publish copy for every chosen channel, ending with the closing ask:",
      ...input.channels.map((c) => `  - ${CHANNEL_PROMPT[c]}: ${CHANNEL_COPY_RULES[c]}.`),
      "- Never invent benchmarks, prices or results. When a KPI needs a target the brain doesn't give, describe what a good first result looks like instead of making up a number.",
    ]
      .filter(Boolean)
      .join("\n"),
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
