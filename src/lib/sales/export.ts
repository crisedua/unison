// Exports for sending a campaign from Hostinger Reach. Safe to import from client code.
import type { EmailCampaign } from "./campaign";

/** What the app knows about reaching one prospect, read from their notes. */
export type ContactInfo = {
  email: string;
  /** Explorium prospect id, when the prospect came from a search. */
  prospectId: string;
  /** True once an email lookup ran (found or not), so it isn't paid for twice. */
  emailChecked: boolean;
};

export const EMAIL_NOT_FOUND_NOTE = "Email: not found by Vibe Prospecting";

/** Reads the "Email: …" and "prospect <id>" lines the app writes into opportunity notes. */
export function parseContactNotes(notes: readonly string[]): ContactInfo {
  const info: ContactInfo = { email: "", prospectId: "", emailChecked: false };
  for (const note of notes) {
    const email = note.match(/^Email:\s*([^\s@]+@[^\s@]+\.[^\s@]+)\s*$/im)?.[1];
    if (email && !info.email) info.email = email;
    if (/^Email:/im.test(note)) info.emailChecked = true;
    const id = note.match(/prospect ([a-f0-9]{40})/i)?.[1];
    if (id && !info.prospectId) info.prospectId = id;
  }
  return info;
}

export type ReachContact = {
  email: string;
  firstName: string;
  lastName: string;
  company: string;
  jobTitle: string;
};

function csvCell(value: string) {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function splitName(fullName: string) {
  const [first = "", ...rest] = fullName.trim().split(/\s+/);
  return { firstName: first, lastName: rest.join(" ") };
}

/**
 * Contacts CSV for Hostinger Reach's import. "email", "name" and "surname" match
 * Reach's own contact fields; company and job title can be mapped to custom
 * fields or skipped. Starts with a UTF-8 byte order mark so accents survive Excel.
 */
export function contactsToReachCsv(contacts: readonly ReachContact[]) {
  const header = ["email", "name", "surname", "company", "job_title"];
  const rows = contacts.map((c) => [c.email, c.firstName, c.lastName, c.company, c.jobTitle]);
  return `﻿${[header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

const HOSTINGER_WORDS = {
  en: { firstNameFallback: "there", company: "your company", role: "your role" },
  // Reach shows the fallback when the contact has no name; a space skips it.
  es: { firstNameFallback: " ", company: "tu empresa", role: "tu cargo" },
} as const;

/**
 * The campaign rewritten for Hostinger Reach: {{first_name}} becomes Reach's
 * {{name, fallback}} tag. Reach has no company or job-title field, so those
 * merge fields become generic words.
 */
export function toHostingerCampaign(campaign: EmailCampaign, language: string): EmailCampaign {
  const words = HOSTINGER_WORDS[language.startsWith("es") ? "es" : "en"];
  const convert = (text: string) =>
    text
      .replace(/\{\{\s*first_name\s*\}\}/g, `{{name, ${words.firstNameFallback}}}`)
      .replace(/\{\{\s*company\s*\}\}/g, words.company)
      .replace(/\{\{\s*role\s*\}\}/g, words.role);
  return {
    ...campaign,
    emails: campaign.emails.map((email) => ({ ...email, subject: convert(email.subject), body: convert(email.body) })),
  };
}

export function downloadFile(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
