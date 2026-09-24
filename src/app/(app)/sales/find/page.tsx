import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { getReadyContext } from "@/lib/context";
import { getCredits, isLeadsConfigured } from "@/lib/leads/explorium";
import { FindLeads } from "./find-leads";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("leads");
  return { title: t("title") };
}

export default async function FindLeadsPage() {
  const ctx = await getReadyContext();
  if (!ctx) return null;
  if (!ctx.activeBrand) redirect("/brain");

  const configured = isLeadsConfigured();
  const credits = configured ? await getCredits().catch(() => null) : null;

  const t = await getTranslations("leads");
  const tSales = await getTranslations("sales");

  return (
    <div>
      <Link
        href="/sales"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {tSales("backToSales")}
      </Link>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <FindLeads configured={configured} credits={credits} />
    </div>
  );
}
