import "server-only";
import type { ContentLanguage } from "@/lib/languages";
import { campaignSchema, type EmailCampaign } from "@/lib/sales/campaign";
import { salesSchemas, type SalesOutput, type SalesOutputType } from "@/lib/sales/schema";
import type { Brand, BrandDocument, Opportunity, OpportunityNote } from "@/lib/types";
import { buildBrainBlock, languageLine } from "./prompt";
import { runStructured, type RunResult } from "./run";

/** Total characters of opportunity notes sent to the model (newest first). */
const NOTES_BUDGET = 30_000;

const TASKS: Record<SalesOutputType, string> = {
  discovery_brief: [
    "# TASK: DISCOVERY CALL BRIEF",
    "Prepare the salesperson for their next call with this opportunity.",
    "- context: only what the notes and the Company Brain actually say. Mark anything uncertain as an assumption to check.",
    "- likely_pains: pains to confirm, not to assume.",
    "- questions: exactly 5 open questions in the order to ask them, each with the value it helps explore. No yes/no questions.",
    "- next_step: one concrete step to propose before the call ends (who does what, by when).",
  ].join("\n"),
  outreach_sequence: [
    "# TASK: OUTREACH EMAIL SEQUENCE",
    "Write 3 short emails to this contact: day 0, around day 3 and around day 7.",
    "- Personalize only with what the notes and the opportunity actually say. No fake familiarity (never pretend you've met or read something you haven't).",
    "- One ask per email, plain text, under 120 words. Follow-ups add something new instead of 'just checking in'.",
    "- Use the contact's first name when it's known; otherwise write a greeting that works without it.",
  ].join("\n"),
  call_follow_up: [
    "# TASK: FOLLOW-UP EMAIL AFTER A CALL",
    "Write the email to send after the call described in the most recent notes.",
    "- recap: what was learned or agreed, only from the notes.",
    "- Confirm one clear next step with an owner and a date if the notes give one; otherwise propose one.",
    "- Short, warm and specific. No generic thank-you filler.",
  ].join("\n"),
};

function opportunityBlock(opportunity: Opportunity, notes: OpportunityNote[]) {
  const contact = [opportunity.contact_name, opportunity.contact_role].filter((v) => v.trim()).join(", ");
  const noteParts: string[] = [];
  let used = 0;
  for (const note of notes) {
    if (used + note.content.length > NOTES_BUDGET && noteParts.length > 0) break;
    noteParts.push(`### ${note.created_at.slice(0, 10)}\n${note.content.slice(0, NOTES_BUDGET)}`);
    used += note.content.length;
  }

  return [
    "# OPPORTUNITY",
    `Company: ${opportunity.company_name}`,
    `Contact: ${contact || "(unknown)"}`,
    `Stage: ${opportunity.stage}`,
    `## Notes (newest first)\n${noteParts.join("\n\n") || "(no notes yet)"}`,
  ].join("\n");
}

export async function compileSalesOutput<T extends SalesOutputType>(args: {
  brand: Brand;
  documents: BrandDocument[];
  opportunity: Opportunity;
  notes: OpportunityNote[];
  type: T;
  focus: string;
  language: ContentLanguage;
}): Promise<RunResult<SalesOutput[T]>> {
  const brain = buildBrainBlock(args.brand, args.documents);
  const task = [
    TASKS[args.type],
    opportunityBlock(args.opportunity, args.notes),
    ["## Settings", languageLine(args.language), args.focus.trim() && `- Extra note from the user: ${args.focus.trim()}`]
      .filter(Boolean)
      .join("\n"),
  ].join("\n\n");

  return runStructured<SalesOutput[T]>({
    brandId: args.brand.id,
    brain,
    task,
    schema: salesSchemas[args.type],
    schemaName: args.type,
  });
}

// ---------------------------------------------------------------------------
// Email campaign: one sequence for a group, personalized with merge fields
// ---------------------------------------------------------------------------

const CAMPAIGN_TASK = [
  "# TASK: EMAIL CAMPAIGN FOR A GROUP OF PROSPECTS",
  "Write ONE sequence of 3 short cold emails (day 0, around day 3, around day 7) that will go to every prospect listed below. The same text is sent to all of them, so write for what they have in common: their roles, industries and company sizes.",
  "- Personalize only through merge fields, written exactly like this: {{first_name}}, {{company}}, {{role}}. Use {{first_name}} in the greeting of every email and {{company}} at least once in the sequence. Use {{role}} only if every prospect listed has a role. Never write a real prospect's name or company into the text.",
  "- Cold outreach: they have never heard from us. No fake familiarity, and no claims about their company beyond what the list supports.",
  "- One ask per email, plain text, under 120 words. Follow-ups add something new instead of 'just checking in'.",
].join("\n");

function prospectsBlock(prospects: Opportunity[]) {
  const lines = prospects.map(
    (p) => `- ${p.contact_name || "(no name)"} — ${p.contact_role || "(no role)"} — ${p.company_name}`,
  );
  return `# PROSPECTS (${prospects.length})\n${lines.join("\n")}`;
}

export async function compileEmailCampaign(args: {
  brand: Brand;
  documents: BrandDocument[];
  prospects: Opportunity[];
  focus: string;
  language: ContentLanguage;
}): Promise<RunResult<EmailCampaign>> {
  const brain = buildBrainBlock(args.brand, args.documents);
  const task = [
    CAMPAIGN_TASK,
    prospectsBlock(args.prospects),
    ["## Settings", languageLine(args.language), args.focus.trim() && `- Extra note from the user: ${args.focus.trim()}`]
      .filter(Boolean)
      .join("\n"),
  ].join("\n\n");

  return runStructured<EmailCampaign>({
    brandId: args.brand.id,
    brain,
    task,
    schema: campaignSchema,
    schemaName: "email_campaign",
  });
}
