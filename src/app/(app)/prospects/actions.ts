"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getReadyContext } from "@/lib/context";
import { enrichContacts, searchProspects, type ContactDetails, type ProspectingErrorCode } from "@/lib/prospects/explorium";
import { searchSchema, type Prospect, type ProspectSearch } from "@/lib/prospects/schema";
import { createClient } from "@/lib/supabase/server";

type ErrorCode = ProspectingErrorCode | "invalid_input" | "not_ready";

export type SearchResult =
  | { ok: true; prospects: Prospect[]; total: number }
  | { ok: false; error: ErrorCode };

export async function findProspects(raw: ProspectSearch): Promise<SearchResult> {
  if (!(await getReadyContext())) return { ok: false, error: "not_ready" };
  const parsed = searchSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const result = await searchProspects(parsed.data);
  return result.ok ? { ok: true, ...result.data } : result;
}

const prospectIds = z.array(z.string().regex(/^[a-f0-9]{40}$/)).min(1).max(100);

export type ContactsResult = { ok: true; contacts: ContactDetails[] } | { ok: false; error: ErrorCode };

export async function findContactDetails(ids: string[], withPhone: boolean): Promise<ContactsResult> {
  if (!(await getReadyContext())) return { ok: false, error: "not_ready" };
  const parsed = prospectIds.safeParse([...new Set(ids)]);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const result = await enrichContacts(parsed.data, withPhone === true);
  return result.ok ? { ok: true, contacts: result.data } : result;
}

const short = (max: number) => z.string().trim().max(2000).transform((value) => value.slice(0, max));

const saleSchema = z
  .array(
    z.object({
      fullName: short(200),
      jobTitle: short(200),
      companyName: short(200),
      companyWebsite: short(500),
      linkedin: short(500),
      email: short(320),
      phone: short(50),
      city: short(200),
      country: short(200),
    }),
  )
  .min(1)
  .max(100);

export type AddToSalesResult = { ok: true; added: number } | { ok: false; error: ErrorCode | "save_failed" };

/** Creates one Sales opportunity per prospect, with what we know as its first note. */
export async function addProspectsToSales(raw: z.input<typeof saleSchema>): Promise<AddToSalesResult> {
  const ctx = await getReadyContext();
  if (!ctx?.activeBrand) return { ok: false, error: "not_ready" };
  const parsed = saleSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();
  const rows = parsed.data.map((p) => ({
    brand_id: ctx.activeBrand!.id,
    workspace_id: ctx.workspaceId,
    company_name: p.companyName || p.fullName || "—",
    contact_name: p.fullName,
    contact_role: p.jobTitle,
    stage: "new",
    created_by: ctx.userId,
  }));
  const { data, error } = await supabase.from("unison_opportunities").insert(rows).select("id");
  if (error || !data) {
    console.error("[addProspectsToSales]", error?.message);
    return { ok: false, error: "save_failed" };
  }

  const notes = data.flatMap((row, i) => {
    const p = parsed.data[i];
    const lines = [
      p.jobTitle && p.companyName ? `${p.jobTitle} · ${p.companyName}` : p.jobTitle || p.companyName,
      [p.city, p.country].filter(Boolean).join(", "),
      p.email && `Email: ${p.email}`,
      p.phone && `Phone: ${p.phone}`,
      p.linkedin && `LinkedIn: ${p.linkedin}`,
      p.companyWebsite && `Website: ${p.companyWebsite}`,
      "Source: Prospects (Explorium)",
    ].filter(Boolean);
    return [{ opportunity_id: row.id, workspace_id: ctx.workspaceId, content: lines.join("\n"), created_by: ctx.userId }];
  });
  const { error: notesError } = await supabase.from("unison_opportunity_notes").insert(notes);
  if (notesError) console.error("[addProspectsToSales] notes:", notesError.message);

  revalidatePath("/sales");
  return { ok: true, added: data.length };
}
