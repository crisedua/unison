import "server-only";
import { z } from "zod";
import { COMPANY_SIZES, JOB_LEVELS, LEAD_COUNTRIES, type LeadSearch } from "@/lib/leads/schema";
import type { Brand, BrandDocument } from "@/lib/types";
import { buildBrainBlock } from "./prompt";
import { runStructured, type RunResult } from "./run";

// The AI only chooses filters; the search itself runs through Explorium as usual.
export const leadFiltersSchema = z.object({
  job_titles: z
    .array(z.string())
    .describe("0 to 5 job titles as people write them on LinkedIn, e.g. 'Marketing manager'. Empty if the request names none."),
  job_levels: z.array(z.enum(JOB_LEVELS)).describe("Seniority levels the request implies. Empty if any."),
  industry: z
    .string()
    .describe("One short industry phrase, e.g. 'Roofing contractor' or 'Software development'. Empty if any industry."),
  company_sizes: z.array(z.enum(COMPANY_SIZES)).describe("Employee ranges that fit. Empty if any size."),
  country: z
    .enum([...LEAD_COUNTRIES, "any"])
    .describe("Company headquarters country as an ISO code from the list, or 'any' when none is named or it isn't in the list."),
  summary: z.string().describe("One sentence, in the user's language, saying who will be searched for."),
});
export type LeadFilters = z.infer<typeof leadFiltersSchema>;

const TASK_FROM_TEXT = [
  "# TASK: TURN A PROSPECTING REQUEST INTO SEARCH FILTERS",
  "The user describes the people they want to find. Choose filters for a B2B people database.",
  "- Only set a filter the request states or clearly implies. Fewer filters find more people; don't narrow on guesses.",
  "- Owners of small businesses usually show up as 'owner' or 'founder'; decision makers as 'c-suite', 'owner' or 'founder'.",
  "- 'Small business' means 1-10 and 11-50 employees unless the request says otherwise.",
  "- Put the trade or sector in industry, not in job_titles.",
  "- If the request says 'my customers', 'my audience' or similar, use the Company Brain's audience.",
].join("\n");

const TASK_FROM_BRAIN = [
  "# TASK: SUGGEST WHO TO PROSPECT FROM THE COMPANY BRAIN",
  "Read the Company Brain's audience, problem and offer, and choose filters that find the people most likely to buy.",
  "- Target the person who decides to buy, not every employee.",
  "- Only set filters the brain supports. Fewer filters find more people; don't narrow on guesses.",
  "- If the brain names a market or country, use it; otherwise leave country as 'any'.",
].join("\n");

export async function compileLeadFilters(args: {
  brand: Brand;
  documents: BrandDocument[];
  /** Empty means "suggest from the Company Brain". */
  request: string;
}): Promise<RunResult<LeadFilters>> {
  const brain = buildBrainBlock(args.brand, args.documents);
  const request = args.request.trim();
  const task = request ? `${TASK_FROM_TEXT}\n\n## The request\n${request}` : TASK_FROM_BRAIN;

  return runStructured<LeadFilters>({
    brandId: args.brand.id,
    brain,
    task,
    schema: leadFiltersSchema,
    schemaName: "lead_filters",
  });
}

/** The AI's filters as the search form's values (the result count stays the user's choice). */
export function toLeadSearch(filters: LeadFilters): Omit<LeadSearch, "count"> {
  return {
    jobTitles: [...new Set(filters.job_titles.map((t) => t.trim()).filter(Boolean))].slice(0, 5).join(", ").slice(0, 200),
    jobLevels: [...new Set(filters.job_levels)],
    industry: filters.industry.trim().slice(0, 120),
    companySizes: [...new Set(filters.company_sizes)],
    country: filters.country === "any" ? "" : filters.country,
  };
}
