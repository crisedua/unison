import { NotebookPen, PenLine } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { z } from "zod";
import { ASSET_ICONS } from "@/components/content-set/asset-icons";
import { DeleteItemButton } from "@/components/delete-item-button";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getReadyContext } from "@/lib/context";
import { ASSET_TYPES, type AssetType } from "@/lib/engine/assets";
import { generationHref } from "@/lib/generation-href";
import { isContentLanguage } from "@/lib/languages";
import { createClient } from "@/lib/supabase/server";
import type { GenerationRow } from "@/lib/types";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("library");
  return { title: t("title") };
}

const storedAssets = z.object({ assets: z.array(z.enum(ASSET_TYPES)).catch([]) }).catch({ assets: [] });

export default async function LibraryPage({ searchParams }: PageProps<"/library">) {
  const ctx = await getReadyContext();
  if (!ctx) return null;
  if (!ctx.activeBrand) redirect("/brain");

  const { tab } = await searchParams;
  const brandId = ctx.activeBrand.id;
  const supabase = await createClient();
  const [setsResult, draftsResult] = await Promise.all([
    supabase
      .from("unison_generations")
      .select("id, studio, title, input, facts_used, language, campaign_id, opportunity_id, created_at")
      .eq("brand_id", brandId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("unison_drafts")
      .select("id, title, asset_type, updated_at")
      .eq("brand_id", brandId)
      .order("updated_at", { ascending: false })
      .limit(200),
  ]);

  type SetRow = Pick<
    GenerationRow,
    "id" | "studio" | "title" | "input" | "facts_used" | "language" | "campaign_id" | "opportunity_id" | "created_at"
  >;
  type DraftListRow = { id: string; title: string; asset_type: string; updated_at: string };
  const sets = (setsResult.data ?? []) as SetRow[];
  const drafts = (draftsResult.data ?? []) as DraftListRow[];

  const t = await getTranslations("library");
  const tStudio = await getTranslations("studio");
  const tLanguages = await getTranslations("languages");
  const format = await getFormatter();
  const date = (value: string) => format.dateTime(new Date(value), { dateStyle: "medium", timeStyle: "short" });
  const isAsset = (value: string): value is AssetType => (ASSET_TYPES as readonly string[]).includes(value);

  return (
    <div>
      <PageHeader title={t("title")} description={t("subtitle", { brand: ctx.activeBrand.name })}>
        <Button asChild>
          <Link href="/studio">
            <PenLine />
            {t("openStudio")}
          </Link>
        </Button>
      </PageHeader>

      <Tabs defaultValue={tab === "drafts" ? "drafts" : "sets"} className="gap-4">
        <TabsList>
          <TabsTrigger value="sets" className="px-3">
            {t("setsTab")} · {sets.length}
          </TabsTrigger>
          <TabsTrigger value="drafts" className="px-3">
            {t("draftsTab")} · {drafts.length}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sets">
          {sets.length === 0 ? (
            <Empty text={t("emptySets")} />
          ) : (
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {sets.map((set) => {
                const assets = set.studio === "content" ? storedAssets.parse(set.input).assets : [];
                return (
                  <li key={set.id} className="relative">
                    <Link
                      href={generationHref(set)}
                      className="block h-full rounded-xl bg-card p-4 pr-11 ring-1 ring-foreground/10 transition-shadow hover:shadow-md hover:ring-primary/40"
                    >
                      <p className="font-heading font-bold">{set.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t(`studios.${set.studio}`)} · {date(set.created_at)}
                        {isContentLanguage(set.language) && ` · ${tLanguages(set.language)}`}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {assets.map((type) => {
                          const Icon = ASSET_ICONS[type];
                          return (
                            <span
                              key={type}
                              className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
                            >
                              <Icon className="size-3" />
                              {tStudio(`assets.${type}`)}
                            </span>
                          );
                        })}
                      </div>
                    </Link>
                    <DeleteItemButton kind="generation" id={set.id} title={set.title} className="absolute top-2.5 right-2.5" />
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="drafts">
          {drafts.length === 0 ? (
            <Empty text={t("emptyDrafts")} />
          ) : (
            <ul className="divide-y overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
              {drafts.map((draft) => {
                const Icon = isAsset(draft.asset_type) ? ASSET_ICONS[draft.asset_type] : NotebookPen;
                return (
                  <li key={draft.id} className="flex items-center gap-1 pr-2 transition-colors hover:bg-muted/60">
                    <Link href={`/drafts/${draft.id}`} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3">
                      <Icon className="size-4 shrink-0 text-primary" />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{draft.title}</span>
                      <span className="hidden text-xs text-muted-foreground sm:inline">
                        {isAsset(draft.asset_type) && tStudio(`assets.${draft.asset_type}`)} · {date(draft.updated_at)}
                      </span>
                    </Link>
                    <DeleteItemButton kind="draft" id={draft.id} title={draft.title} />
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-dashed px-6 py-14 text-center text-sm text-muted-foreground">{text}</p>
  );
}
