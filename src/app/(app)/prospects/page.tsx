import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { getReadyContext } from "@/lib/context";
import { isProspectingConfigured } from "@/lib/prospects/explorium";
import { ProspectFinder } from "./prospects-client";

// Contact lookups for 100 prospects are two round trips to Explorium.
export const maxDuration = 120;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("prospects");
  return { title: t("title") };
}

export default async function ProspectsPage() {
  const ctx = await getReadyContext();
  if (!ctx) return null;
  if (!ctx.activeBrand) redirect("/brain");

  const t = await getTranslations("prospects");
  return (
    <div>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <ProspectFinder configured={isProspectingConfigured()} />
    </div>
  );
}
