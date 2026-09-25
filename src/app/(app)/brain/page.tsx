import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CreateBrandForm } from "@/components/app-shell/create-brand-form";
import { Logo } from "@/components/logo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loadBrand, loadDocuments } from "@/lib/brain/queries";
import { loadVisualStyle } from "@/lib/brain/visual";
import { getReadyContext } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { BrainEditor } from "./brain-editor";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("brain");
  return { title: t("title") };
}

export default async function BrainPage() {
  const ctx = await getReadyContext();
  if (!ctx) return null;

  if (!ctx.activeBrand) {
    const t = await getTranslations("brand");
    return (
      <div className="mx-auto max-w-md py-10">
        <Card className="gap-6 py-7">
          <CardHeader className="gap-3 px-7">
            <Logo />
            <CardTitle className="text-2xl font-bold">{t("createTitle")}</CardTitle>
            <CardDescription>{t("createBody")}</CardDescription>
          </CardHeader>
          <CardContent className="px-7">
            <CreateBrandForm />
          </CardContent>
        </Card>
      </div>
    );
  }

  const supabase = await createClient();
  const [brand, documents, visual] = await Promise.all([
    loadBrand(supabase, ctx.activeBrand.id),
    loadDocuments(supabase, ctx.activeBrand.id),
    loadVisualStyle(supabase, ctx.activeBrand.id),
  ]);
  if (!brand) notFound();

  return <BrainEditor key={brand.id} brand={brand} documents={documents} visual={visual} />;
}
