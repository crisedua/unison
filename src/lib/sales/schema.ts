// Sales outputs written for one opportunity. Safe to import from client code.
import { z } from "zod";
import { FACT_KEYS, type FactKey } from "@/lib/brain/facts";

export const OPPORTUNITY_STAGES = ["new", "contacted", "meeting", "proposal", "won", "lost"] as const;
export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number];

export const SALES_OUTPUTS = ["discovery_brief", "outreach_sequence", "call_follow_up"] as const;
export type SalesOutputType = (typeof SALES_OUTPUTS)[number];

export function isSalesOutputType(value: unknown): value is SalesOutputType {
  return typeof value === "string" && (SALES_OUTPUTS as readonly string[]).includes(value);
}

const factsUsed = z.array(z.enum(FACT_KEYS));

export const salesSchemas = {
  discovery_brief: z.object({
    title: z.string().describe("Short name, e.g. 'Discovery call — Acme'"),
    context: z.string().describe("What we know so far, drawn only from the notes and the Company Brain"),
    likely_pains: z.array(z.string()).describe("2 to 4 pains to confirm on the call"),
    questions: z
      .array(
        z.object({
          question: z.string(),
          value_to_explore: z.string().describe("What the answer tells you or unlocks"),
        }),
      )
      .describe("Exactly 5 questions, in the order to ask them"),
    watch_outs: z.array(z.string()).describe("0 to 3 likely objections or risks"),
    next_step: z.string().describe("The one concrete next step to propose before the call ends"),
    facts_used: factsUsed,
  }),
  outreach_sequence: z.object({
    title: z.string(),
    emails: z
      .array(
        z.object({
          send_on_day: z.number().int().min(0).max(30),
          subject: z.string().describe("50 characters max"),
          body: z.string().describe("Plain text, under 120 words"),
        }),
      )
      .describe("Exactly 3 emails: day 0, around day 3 and around day 7"),
    facts_used: factsUsed,
  }),
  call_follow_up: z.object({
    title: z.string(),
    subject: z.string(),
    body: z.string().describe("Plain text email sent after the call"),
    recap: z.array(z.string()).describe("2 to 5 points that were learned or agreed"),
    next_step: z.string(),
    facts_used: factsUsed,
  }),
};

export type SalesOutput = { [K in SalesOutputType]: z.infer<(typeof salesSchemas)[K]> };

/** Facts the engine needs before it will write each output. */
export const salesRequirements: Record<SalesOutputType, readonly FactKey[]> = {
  discovery_brief: ["company", "audience"],
  outreach_sequence: ["company", "audience", "voice"],
  call_follow_up: ["company", "voice"],
};

export function parseStoredSales<T extends SalesOutputType>(type: T, value: unknown): SalesOutput[T] | null {
  const parsed = salesSchemas[type].safeParse(value);
  return parsed.success ? (parsed.data as SalesOutput[T]) : null;
}
