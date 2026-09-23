import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { factStatus } from "@/lib/brain/facts";
import { loadBrand, loadDocuments } from "@/lib/brain/queries";
import { getReadyContext } from "@/lib/context";
import { isAiConfigured } from "@/lib/engine/openai";
import { createClient } from "@/lib/supabase/server";
import { ContentStudio } from "./content-studio";

// Writing a full set can take a minute; allow Server Actions on this page up to 5.
export const maxDuration = 300;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("studio");
  return { title: t("title") };
}

export default async function StudioPage({ searchParams }: PageProps<"/studio">) {
  const { idea } = await searchParams;
  const ctx = await getReadyContext();
  if (!ctx) return null;
  if (!ctx.activeBrand) redirect("/brain");

  const supabase = await createClient();
  const [brand, documents] = await Promise.all([
    loadBrand(supabase, ctx.activeBrand.id),
    loadDocuments(supabase, ctx.activeBrand.id),
  ]);
  if (!brand) redirect("/brain");

  return (
    <ContentStudio
      // A new prefilled idea (e.g. from a campaign angle) starts a fresh form.
      key={`${brand.id}:${typeof idea === "string" ? idea : ""}`}
      status={factStatus(brand, documents.length)}
      documents={documents.map(({ id, title, kind }) => ({ id, title, kind }))}
      defaultLanguage={brand.content_language}
      aiConfigured={isAiConfigured()}
      initialIdea={typeof idea === "string" ? idea.slice(0, 6000) : ""}
    />
  );
}
