import "server-only";
import type { Prospect, ProspectSearch } from "./schema";

// Explorium is the data provider behind Vibe Prospecting. Its API key lives in EXPLORIUM_API_KEY.
const API_URL = (process.env.EXPLORIUM_API_URL?.trim() || "https://api.explorium.ai").replace(/\/$/, "");

export function isProspectingConfigured() {
  return Boolean(process.env.EXPLORIUM_API_KEY?.trim());
}

export type ProspectingErrorCode =
  | "prospecting_not_configured"
  | "prospecting_key_invalid"
  | "prospecting_no_credits"
  | "prospecting_rate_limited"
  | "prospecting_failed";

type Result<T> = { ok: true; data: T } | { ok: false; error: ProspectingErrorCode };

async function call<T>(path: string, body: unknown): Promise<Result<T>> {
  if (!isProspectingConfigured()) return { ok: false, error: "prospecting_not_configured" };
  try {
    const response = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        api_key: process.env.EXPLORIUM_API_KEY!.trim(),
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
    });
    if (response.status === 401 || response.status === 403) return { ok: false, error: "prospecting_key_invalid" };
    if (response.status === 402) return { ok: false, error: "prospecting_no_credits" };
    if (response.status === 429) return { ok: false, error: "prospecting_rate_limited" };
    if (!response.ok) {
      console.error(`[explorium ${path}]`, response.status, (await response.text()).slice(0, 500));
      return { ok: false, error: "prospecting_failed" };
    }
    return { ok: true, data: (await response.json()) as T };
  } catch (error) {
    console.error(`[explorium ${path}]`, error);
    return { ok: false, error: "prospecting_failed" };
  }
}

type RawProspect = {
  prospect_id: string;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  job_title?: string | null;
  job_level_main?: string | null;
  job_department_main?: string | null;
  company_name?: string | null;
  company_website?: string | null;
  company_linkedin?: string | null;
  linkedin?: string | null;
  city?: string | null;
  region_name?: string | null;
  country_name?: string | null;
};

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

// Explorium sends country names in lowercase ("united states"); "and"/"of" stay lowercase.
const titleCase = (value: string) =>
  value.replace(/\p{L}+/gu, (word, offset) =>
    offset > 0 && ["and", "of", "the"].includes(word) ? word : word[0].toUpperCase() + word.slice(1),
  );

function toProspect(raw: RawProspect): Prospect {
  const firstName = text(raw.first_name);
  const lastName = text(raw.last_name);
  return {
    id: raw.prospect_id,
    fullName: text(raw.full_name) || `${firstName} ${lastName}`.trim(),
    firstName,
    lastName,
    jobTitle: text(raw.job_title),
    jobLevel: text(raw.job_level_main),
    department: text(raw.job_department_main),
    companyName: text(raw.company_name),
    companyWebsite: text(raw.company_website),
    companyLinkedin: text(raw.company_linkedin),
    linkedin: text(raw.linkedin),
    city: text(raw.city),
    region: text(raw.region_name),
    country: titleCase(text(raw.country_name)),
    email: "",
    phone: "",
    contactsChecked: false,
  };
}

const values = <T,>(list: readonly T[]) => (list.length > 0 ? { values: list } : undefined);

export async function searchProspects(
  search: ProspectSearch,
): Promise<Result<{ prospects: Prospect[]; total: number }>> {
  const filters = Object.fromEntries(
    Object.entries({
      job_level: values(search.jobLevels),
      job_department: values(search.departments),
      country_code: values(search.countries),
      company_size: values(search.companySizes),
      has_email: search.onlyWithEmail ? { value: true } : undefined,
    }).filter(([, filter]) => filter !== undefined),
  );

  const result = await call<{ data?: RawProspect[]; total_results?: number }>("/v1/prospects", {
    mode: "full",
    size: search.count * search.page,
    page_size: search.count,
    page: search.page,
    filters,
  });
  if (!result.ok) return result;

  const prospects = (result.data.data ?? []).filter((p) => p?.prospect_id).map(toProspect);
  return { ok: true, data: { prospects, total: result.data.total_results ?? prospects.length } };
}

type ContactInfo = {
  professions_email?: string | null;
  professional_email?: string | null;
  emails?: Record<string, string>[] | null;
  mobile_phone?: string | null;
  phone_numbers?: Record<string, string>[] | null;
};

function firstMatching(list: Record<string, string>[] | null | undefined, test: (value: string) => boolean) {
  for (const item of list ?? []) {
    const found = Object.values(item ?? {}).find((value) => typeof value === "string" && test(value));
    if (found) return found;
  }
  return "";
}

export type ContactDetails = { id: string; email: string; phone: string };

/** Looks up emails (and phones if asked) in batches of 50. Every prospect costs a credit, found or not. */
export async function enrichContacts(
  ids: readonly string[],
  withPhone: boolean,
): Promise<Result<ContactDetails[]>> {
  const found: ContactDetails[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const result = await call<{ data?: { prospect_id: string; data?: ContactInfo | null }[] }>(
      "/v1/prospects/contacts_information/bulk_enrich",
      { prospect_ids: batch, parameters: { contact_types: withPhone ? ["email", "phone"] : ["email"] } },
    );
    if (!result.ok) return i === 0 ? result : { ok: true, data: found };

    const rows = new Map((result.data.data ?? []).map((row) => [row.prospect_id, row.data ?? {}]));
    for (const id of batch) {
      const info = rows.get(id) ?? {};
      found.push({
        id,
        email:
          text(info.professions_email) ||
          text(info.professional_email) ||
          firstMatching(info.emails, (value) => value.includes("@")),
        phone: withPhone ? text(info.mobile_phone) || firstMatching(info.phone_numbers, (value) => value.startsWith("+")) : "",
      });
    }
  }
  return { ok: true, data: found };
}
