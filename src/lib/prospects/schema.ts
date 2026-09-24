// Prospect search filters, the prospect record and CSV export. Safe to import from client code.
// Filter values are Explorium's own (see the Prospects API), so they are sent as-is.
import { z } from "zod";

export const JOB_LEVELS = [
  "owner",
  "founder",
  "c-suite",
  "president",
  "vice president",
  "director",
  "senior manager",
  "manager",
  "partner",
] as const;

export const DEPARTMENTS = [
  "operations",
  "finance",
  "it",
  "administration",
  "human resources",
  "c-suite",
  "sales",
  "marketing",
  "customer success",
  "procurement",
  "logistics",
  "data",
  "engineering",
  "legal",
  "strategy",
] as const;

export const COMPANY_SIZES = [
  "1-10",
  "11-50",
  "51-200",
  "201-500",
  "501-1000",
  "1001-5000",
  "5001-10000",
  "10001+",
] as const;

/** ISO 3166-1 alpha-2, lowercase as Explorium expects. Labels come from Intl.DisplayNames. */
export const COUNTRIES = [
  "cl", "mx", "co", "pe", "ar", "br", "uy", "py", "bo", "ec", "ve",
  "cr", "pa", "gt", "hn", "sv", "ni", "do", "us", "ca", "es", "pt", "gb",
] as const;

export const RESULT_COUNTS = [25, 50, 100] as const;

export const searchSchema = z.object({
  jobLevels: z.array(z.enum(JOB_LEVELS)).max(JOB_LEVELS.length),
  departments: z.array(z.enum(DEPARTMENTS)).max(DEPARTMENTS.length),
  countries: z.array(z.enum(COUNTRIES)).max(COUNTRIES.length),
  companySizes: z.array(z.enum(COMPANY_SIZES)).max(COMPANY_SIZES.length),
  onlyWithEmail: z.boolean(),
  count: z.union([z.literal(25), z.literal(50), z.literal(100)]),
  page: z.number().int().min(1).max(100),
});
export type ProspectSearch = z.infer<typeof searchSchema>;

export type Prospect = {
  id: string;
  fullName: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  jobLevel: string;
  department: string;
  companyName: string;
  companyWebsite: string;
  companyLinkedin: string;
  linkedin: string;
  city: string;
  region: string;
  country: string;
  email: string;
  phone: string;
  /** True once contact details were looked up (found or not), so they aren't paid for twice. */
  contactsChecked: boolean;
};

const CSV_COLUMNS: { key: keyof Prospect; header: string }[] = [
  { key: "fullName", header: "Full name" },
  { key: "firstName", header: "First name" },
  { key: "lastName", header: "Last name" },
  { key: "jobTitle", header: "Job title" },
  { key: "jobLevel", header: "Job level" },
  { key: "department", header: "Department" },
  { key: "companyName", header: "Company" },
  { key: "companyWebsite", header: "Company website" },
  { key: "companyLinkedin", header: "Company LinkedIn" },
  { key: "linkedin", header: "LinkedIn" },
  { key: "email", header: "Email" },
  { key: "phone", header: "Phone" },
  { key: "city", header: "City" },
  { key: "region", header: "Region" },
  { key: "country", header: "Country" },
];

function csvCell(value: unknown) {
  let text = String(value ?? "");
  // Spreadsheet apps run cells that start with these as formulas.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

/** CSV with a UTF-8 byte order mark so Excel shows accents correctly. */
export function prospectsToCsv(prospects: readonly Prospect[]) {
  const lines = [
    CSV_COLUMNS.map((c) => csvCell(c.header)).join(","),
    ...prospects.map((p) => CSV_COLUMNS.map((c) => csvCell(p[c.key])).join(",")),
  ];
  return `﻿${lines.join("\r\n")}\r\n`;
}
