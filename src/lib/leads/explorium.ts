// Explorium AgentSource API: the data behind Vibe Prospecting.
// Docs: https://developers.explorium.ai — every call needs the `api_key` header.
import "server-only";
import { z } from "zod";
import type { Lead, LeadSearch } from "./schema";

const BASE_URL = "https://api.explorium.ai";

export function isLeadsConfigured() {
  return Boolean(process.env.EXPLORIUM_API_KEY?.trim());
}

export type LeadsErrorCode =
  | "leads_not_configured"
  | "leads_key_invalid"
  | "leads_no_credits"
  | "leads_rate_limited"
  | "leads_unreachable"
  | "leads_failed";

export class LeadsError extends Error {
  constructor(
    readonly code: LeadsErrorCode,
    detail?: string,
    /** HTTP status Explorium answered with, when it answered. */
    readonly status?: number,
  ) {
    super(detail ? `${code}: ${detail}` : code);
  }
}

/** `path` includes the API version, e.g. "/v2/credits". */
async function call<T>(path: string, init?: { method?: "GET" | "POST"; body?: unknown }): Promise<T> {
  const key = process.env.EXPLORIUM_API_KEY?.trim();
  if (!key) throw new LeadsError("leads_not_configured");

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: init?.method ?? "GET",
      headers: { api_key: key, accept: "application/json", "content-type": "application/json" },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    throw new LeadsError("leads_unreachable", error instanceof Error ? error.message : undefined);
  }

  if (response.ok) return (await response.json()) as T;

  const status = response.status;
  const body = `${init?.method ?? "GET"} ${path} → ${status} ${(await response.text().catch(() => "")).slice(0, 500)}`;
  if (status === 401) throw new LeadsError("leads_key_invalid", body, status);
  if (status === 402) throw new LeadsError("leads_no_credits", body, status);
  if (status === 403) throw new LeadsError(/credit/i.test(body) ? "leads_no_credits" : "leads_key_invalid", body, status);
  if (status === 429) throw new LeadsError("leads_rate_limited", body, status);
  throw new LeadsError("leads_failed", body, status);
}

/**
 * Calls the v2 endpoint and, if Explorium answers with a server error or
 * "not found", repeats the request on the older v1 endpoint. v2 search has
 * returned 503 for some accounts while v1 works.
 */
async function callWithV1Fallback<T>(
  v2: { path: string; body: unknown },
  v1: { path: string; body: unknown },
): Promise<T> {
  try {
    return await call<T>(v2.path, { method: "POST", body: v2.body });
  } catch (error) {
    const status = error instanceof LeadsError ? error.status : undefined;
    if (status === undefined || (status < 500 && status !== 404 && status !== 405)) throw error;
    console.warn("[explorium] v2 failed, retrying on v1:", (error as Error).message);
    return call<T>(v1.path, { method: "POST", body: v1.body });
  }
}

// ---------------------------------------------------------------------------
// Credits
// ---------------------------------------------------------------------------

const creditsSchema = z
  .object({ allocated_credits: z.number(), remaining_credits: z.number(), account_type: z.string().optional() })
  .loose();

export type Credits = { allocated: number; remaining: number; accountType: "trial" | "paid" };

export async function getCredits(): Promise<Credits> {
  const raw = creditsSchema.parse(await call("/v2/credits"));
  return {
    allocated: raw.allocated_credits,
    remaining: raw.remaining_credits,
    accountType: raw.account_type === "paid" ? "paid" : "trial",
  };
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

const suggestionsSchema = z.array(z.object({ value: z.string() }).loose());

/** Free text → the standardized values the filters require. Empty when nothing matches. */
async function standardize(field: "job_title" | "linkedin_category", query: string, max = 3): Promise<string[]> {
  const query_ = `field=${field}&query=${encodeURIComponent(query)}`;
  for (const version of ["v2", "v1"]) {
    try {
      const raw = await call<unknown>(`/${version}/autocomplete?${query_}`);
      const parsed = suggestionsSchema.safeParse(raw);
      if (!parsed.success) return [];
      return [...new Set(parsed.data.map((s) => s.value))].slice(0, max);
    } catch (error) {
      if (error instanceof LeadsError && error.code !== "leads_failed") throw error;
      console.warn("[explorium autocomplete]", (error as Error).message);
    }
  }
  // Without a standardized value, the caller falls back to the raw text.
  return [];
}

const prospectSchema = z
  .object({
    prospect_id: z.string(),
    full_name: z.string().nullish(),
    first_name: z.string().nullish(),
    last_name: z.string().nullish(),
    job_title: z.string().nullish(),
    company_name: z.string().nullish(),
    company_website: z.string().nullish(),
    linkedin: z.string().nullish(),
    city: z.string().nullish(),
    region_name: z.string().nullish(),
    country_name: z.string().nullish(),
  })
  .loose();

const searchResponseSchema = z
  .object({ data: z.array(prospectSchema).default([]), total_results: z.number().optional() })
  .loose();

const splitList = (value: string) =>
  value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export async function searchProspects(search: LeadSearch): Promise<{ leads: Lead[]; total: number | null }> {
  const filters: Record<string, unknown> = {};

  const titles = splitList(search.jobTitles);
  if (titles.length) {
    const values = (await Promise.all(titles.map((title) => standardize("job_title", title)))).flat();
    filters.job_title = { values: values.length ? [...new Set(values)] : titles, include_related_job_titles: true };
  }
  if (search.jobLevels.length) filters.job_level = { values: search.jobLevels };

  const keywords = splitList(search.keywords);
  if (search.industry) {
    const categories = await standardize("linkedin_category", search.industry);
    if (categories.length) filters.linkedin_category = { values: categories };
    else keywords.push(search.industry);
  }
  if (keywords.length) filters.website_keywords = { values: keywords };
  if (search.companySizes.length) filters.company_size = { values: search.companySizes };
  if (search.country) filters.company_country_code = { values: [search.country] };

  const raw = await callWithV1Fallback<unknown>(
    { path: "/v2/prospects", body: { mode: "full", page: 1, page_size: search.count, filters } },
    // v1 also requires `size`, the total number of records the query may return.
    { path: "/v1/prospects", body: { mode: "full", size: search.count, page: 1, page_size: search.count, filters } },
  );
  const parsed = searchResponseSchema.safeParse(raw);
  if (!parsed.success) throw new LeadsError("leads_failed", "unexpected response shape");

  const leads = parsed.data.data.map((p): Lead => {
    const name = (p.full_name || [p.first_name, p.last_name].filter(Boolean).join(" ")).trim();
    return {
      id: p.prospect_id,
      name: name.slice(0, 200),
      jobTitle: (p.job_title ?? "").slice(0, 200),
      company: (p.company_name ?? "").slice(0, 200),
      website: (p.company_website ?? "").slice(0, 300),
      linkedin: (p.linkedin ?? "").slice(0, 300),
      location: [p.city, p.region_name, p.country_name].filter(Boolean).join(", ").slice(0, 200),
      email: "",
    };
  });
  return { leads, total: parsed.data.total_results ?? null };
}

// ---------------------------------------------------------------------------
// Email lookup (contact information enrichment)
// ---------------------------------------------------------------------------

const contactResponseSchema = z
  .object({
    data: z
      .array(
        z
          .object({
            prospect_id: z.string(),
            data: z
              .object({
                professional_email: z.string().nullish(),
                professional_email_status: z.string().nullish(),
                // v1 spells the field "professions_email" and may also list emails.
                professions_email: z.string().nullish(),
                emails: z.array(z.record(z.string(), z.unknown())).nullish(),
              })
              .loose()
              .nullish(),
          })
          .loose(),
      )
      .default([]),
  })
  .loose();

/**
 * Work email for each prospect id, in batches of 50. Explorium charges per
 * person looked up, found or not. Emails it marks invalid are dropped.
 */
export async function findEmails(ids: readonly string[]): Promise<Map<string, string>> {
  const emails = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    let raw: unknown;
    const body = { prospect_ids: batch, parameters: { contact_types: ["email"] } };
    try {
      raw = await callWithV1Fallback(
        { path: "/v2/prospects/contact_information/enrich", body },
        { path: "/v1/prospects/contacts_information/bulk_enrich", body },
      );
    } catch (error) {
      // Keep what earlier batches found rather than losing credits already spent.
      if (i > 0) break;
      throw error;
    }
    const parsed = contactResponseSchema.safeParse(raw);
    if (!parsed.success) throw new LeadsError("leads_failed", "unexpected contact response shape");
    for (const row of parsed.data.data) {
      const listed = row.data?.emails
        ?.flatMap((entry) => Object.values(entry))
        .find((value): value is string => typeof value === "string" && value.includes("@"));
      const email = (row.data?.professional_email || row.data?.professions_email || listed || "").trim();
      if (email.includes("@") && row.data?.professional_email_status !== "invalid") {
        emails.set(row.prospect_id, email.slice(0, 320));
      }
    }
  }
  return emails;
}
