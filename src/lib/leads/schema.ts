// Lead search (Vibe Prospecting / Explorium). Safe to import from client code.
import { z } from "zod";

export const JOB_LEVELS = ["c-suite", "founder", "owner", "vice president", "director", "manager"] as const;
export type JobLevel = (typeof JOB_LEVELS)[number];

export const COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1001-5000", "5001-10000", "10001+"] as const;

// ISO country codes offered in the country picker; labels come from Intl.DisplayNames.
export const LEAD_COUNTRIES = [
  "US", "MX", "CL", "CO", "AR", "PE", "EC", "UY", "PA", "CR", "DO", "GT", "BR",
  "ES", "PT", "GB", "DE", "FR", "IT", "NL", "CA", "AU",
] as const;

export const RESULT_COUNTS = [10, 25, 50] as const;

export const leadSearchSchema = z.object({
  jobTitles: z.string().trim().max(200),
  jobLevels: z.array(z.enum(JOB_LEVELS)).max(JOB_LEVELS.length),
  industry: z.string().trim().max(120),
  companySizes: z.array(z.enum(COMPANY_SIZES)).max(COMPANY_SIZES.length),
  country: z.enum(LEAD_COUNTRIES).or(z.literal("")),
  count: z.union([z.literal(10), z.literal(25), z.literal(50)]),
});
export type LeadSearch = z.infer<typeof leadSearchSchema>;

export function hasAnyFilter(search: LeadSearch) {
  return Boolean(
    search.jobTitles ||
      search.jobLevels.length ||
      search.industry ||
      search.companySizes.length ||
      search.country,
  );
}

/** One person found by a search, trimmed to what the app shows and stores. */
export const leadSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().max(200),
  jobTitle: z.string().max(200),
  company: z.string().max(200),
  website: z.string().max(300),
  linkedin: z.string().max(300),
  location: z.string().max(200),
  /** Filled in by the email lookup; empty until then or when none was found. */
  email: z.string().max(320).default(""),
});
export type Lead = z.infer<typeof leadSchema>;

/** Explorium charges this many credits per person for an email lookup, found or not. */
export const EMAIL_LOOKUP_CREDITS = 2;
export const EMAIL_LOOKUP_MAX = 50;

function csvCell(value: string) {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * CSV for importing into an email tool such as Hostinger Reach. Starts with a
 * UTF-8 byte order mark so Excel shows accents correctly.
 */
export function leadsToCsv(leads: readonly Lead[]) {
  const header = ["Email", "First name", "Last name", "Job title", "Company", "Website", "LinkedIn", "Location"];
  const rows = leads.map((lead) => {
    const [first = "", ...rest] = lead.name.trim().split(/\s+/);
    return [lead.email, first, rest.join(" "), lead.jobTitle, lead.company, lead.website, lead.linkedin, lead.location];
  });
  return `﻿${[header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

/** Adds https:// when the API returns a bare domain. */
export function toUrl(value: string) {
  if (!value) return "";
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}
