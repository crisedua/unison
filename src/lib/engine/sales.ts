import "server-only";
import type { ContentLanguage } from "@/lib/languages";
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
