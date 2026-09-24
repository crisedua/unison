// Email campaign: one outreach sequence written for a group of prospects, with
// merge fields filled in per person. Safe to import from client code.
import { z } from "zod";
import { CONTENT_LANGUAGES } from "@/lib/languages";
import type { Opportunity } from "@/lib/types";
import { salesRequirements, salesSchemas, type SalesOutput } from "./schema";

export const CAMPAIGN_TYPE = "email_campaign";
export const MAX_CAMPAIGN_PROSPECTS = 50;

// Same shape as a one-to-one outreach sequence; only the writing task differs.
export const campaignSchema = salesSchemas.outreach_sequence;
export type EmailCampaign = SalesOutput["outreach_sequence"];
export const campaignRequirements = salesRequirements.outreach_sequence;

/** What a campaign generation stores in `input`. */
export const campaignInputSchema = z.object({
  type: z.literal(CAMPAIGN_TYPE),
  language: z.enum(CONTENT_LANGUAGES),
  focus: z.string().catch(""),
  opportunity_ids: z.array(z.uuid()).min(1),
});

export function parseStoredCampaign(value: unknown): EmailCampaign | null {
  const parsed = campaignSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export type MergeFields = Pick<Opportunity, "company_name" | "contact_name" | "contact_role">;

/** The template itself, shown by merging the placeholders with their own names. */
export const TEMPLATE_FIELDS: MergeFields = {
  contact_name: "{{first_name}}",
  company_name: "{{company}}",
  contact_role: "{{role}}",
};

export function firstName(contactName: string) {
  return contactName.trim().split(/\s+/)[0] ?? "";
}

export function mergeText(text: string, fields: MergeFields) {
  const values: Record<string, string> = {
    first_name: firstName(fields.contact_name) || fields.company_name,
    company: fields.company_name,
    role: fields.contact_role,
  };
  return text.replace(/\{\{\s*(first_name|company|role)\s*\}\}/g, (_, key: string) => values[key] ?? "");
}

export function mergeCampaign(campaign: EmailCampaign, fields: MergeFields): EmailCampaign {
  return {
    ...campaign,
    emails: campaign.emails.map((email) => ({
      ...email,
      subject: mergeText(email.subject, fields),
      body: mergeText(email.body, fields),
    })),
  };
}
