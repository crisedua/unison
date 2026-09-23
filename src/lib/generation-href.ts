import type { GenerationRow } from "@/lib/types";

/** Content sets open in the Library; briefs, read-outs and sales outputs open where they were written. */
export function generationHref(g: Pick<GenerationRow, "id" | "studio" | "campaign_id" | "opportunity_id">) {
  if ((g.studio === "campaign" || g.studio === "results") && g.campaign_id) {
    return `/campaigns/${g.campaign_id}${g.studio === "results" ? "#results" : ""}`;
  }
  if (g.studio === "sales" && g.opportunity_id) return `/sales/${g.opportunity_id}`;
  return `/library/${g.id}`;
}
