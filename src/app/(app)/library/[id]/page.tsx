import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { z } from "zod";
import { ContentSetView } from "@/components/content-set/content-set-view";
import { getReadyContext } from "@/lib/context";
import { LENGTHS, parseStoredContentSet, TONES } from "@/lib/engine/assets";
import { CONTENT_LANGUAGES } from "@/lib/languages";
import { createClient } from "@/lib/supabase/server";
import type { GenerationRow } from "@/lib/types";
import { DeleteSetButton } from "./delete-set-button";

const settingsSchema = z.object({
  length: z.enum(LENGTHS),
  tone: z.enum(TONES),
  language: z.enum(CONTENT_LANGUAGES),
});

async function loadSet(id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("unison_generations")
    .select("id, studio, title, input, output, model, campaign_id, opportunity_id, created_at")
    .eq("id", id)
    .maybeSingle();
  return data as Pick<
    GenerationRow,
    "id" | "studio" | "title" | "input" | "output" | "model" | "campaign_id" | "opportunity_id" | "created_at"
  > | null;
}

export async function generateMetadata({ params }: PageProps<"/library/[id]">): Promise<Metadata> {
  const set = await loadSet((await params).id);
  return { title: set?.title };
}

export default async function SetPage({ params }: PageProps<"/library/[id]">) {
  const ctx = await getReadyContext();
  if (!ctx) return null;

  const set = await loadSet((await params).id);
  const output = set ? parseStoredContentSet(set.output) : null;
  if (!set || !output) notFound();

  const settings = settingsSchema.safeParse(set.input);
  const t = await getTranslations("library");
  const format = await getFormatter();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/library"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {t("backToLibrary")}
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {t("writtenOn", { date: format.dateTime(new Date(set.created_at), { dateStyle: "medium", timeStyle: "short" }) })}{" "}
            · {t("model", { model: set.model })}
          </span>
          <DeleteSetButton id={set.id} />
        </div>
      </div>
      <ContentSetView
        output={output}
        generationId={set.id}
        settings={settings.success ? settings.data : undefined}
      />
    </div>
  );
}
