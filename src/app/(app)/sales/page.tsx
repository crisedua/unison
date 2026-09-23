import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { StageBadge } from "@/components/sales/stage-badge";
import { getReadyContext } from "@/lib/context";
import { listOpportunities } from "@/lib/sales/queries";
import { createClient } from "@/lib/supabase/server";
import { NewOpportunityDialog } from "./new-opportunity-dialog";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("sales");
  return { title: t("title") };
}

export default async function SalesPage() {
  const ctx = await getReadyContext();
  if (!ctx) return null;
  if (!ctx.activeBrand) redirect("/brain");

  const supabase = await createClient();
  const opportunities = await listOpportunities(supabase, ctx.activeBrand.id);

  const t = await getTranslations("sales");
  const format = await getFormatter();

  return (
    <div>
      <PageHeader title={t("title")} description={t("subtitle")}>
        <NewOpportunityDialog />
      </PageHeader>

      {opportunities.length === 0 ? (
        <p className="rounded-xl border border-dashed px-6 py-14 text-center text-sm text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
          {opportunities.map((opportunity) => {
            const contact = [opportunity.contact_name, opportunity.contact_role].filter((v) => v.trim()).join(", ");
            return (
              <li key={opportunity.id}>
                <Link
                  href={`/sales/${opportunity.id}`}
                  className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/60"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{opportunity.company_name}</p>
                    {contact && <p className="truncate text-xs text-muted-foreground">{contact}</p>}
                  </div>
                  <span className="hidden text-xs text-muted-foreground sm:inline">
                    {t("updated", {
                      date: format.dateTime(new Date(opportunity.updated_at), { dateStyle: "medium" }),
                    })}
                  </span>
                  <StageBadge stage={opportunity.stage} label={t(`stages.${opportunity.stage}`)} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
