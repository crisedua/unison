"use client";

import { Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { CopyButton, SaveDraftButton } from "@/components/draft-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ASSET_TYPES,
  type AssetOutput,
  type AssetType,
  type ContentSetOutput,
  type Length,
  type Tone,
} from "@/lib/engine/assets";
import type { ContentLanguage } from "@/lib/languages";
import { AssetBody } from "./asset-body";
import { ASSET_ICONS } from "./asset-icons";
import { FactsUsed } from "./facts-used";
import { assetTitle, assetToMarkdown, downloadText, slugify } from "./to-markdown";
import { useMarkdownLabels } from "./use-markdown-labels";

export type SetSettings = { length: Length; tone: Tone; language: ContentLanguage };

export function ContentSetView({
  output,
  generationId,
  settings,
}: {
  output: ContentSetOutput;
  generationId: string | null;
  settings?: SetSettings;
}) {
  const t = useTranslations("result");
  const tStudio = useTranslations("studio");
  const tLanguages = useTranslations("languages");
  const types = ASSET_TYPES.filter((type) => output.assets[type]);

  return (
    <div className="space-y-4">
      <Card className="gap-3 py-5">
        <CardHeader className="gap-1.5 px-5">
          <CardTitle className="text-xl font-bold">{output.title}</CardTitle>
          {output.core_idea && <CardDescription className="text-[15px]">{output.core_idea}</CardDescription>}
        </CardHeader>
        <CardContent className="space-y-2 px-5">
          <FactsUsed facts={output.facts_used} />
          {settings && (
            <p className="text-xs text-muted-foreground">
              {t("summary", {
                length: tStudio(`lengths.${settings.length}`),
                tone: tStudio(`tones.${settings.tone}`),
                count: output.facts_used.length,
              })}{" "}
              · {tLanguages(settings.language)}
            </p>
          )}
        </CardContent>
      </Card>

      {types.length > 0 && (
        <Tabs defaultValue={types[0]} className="gap-3">
          <TabsList className="w-full flex-wrap justify-start gap-1 bg-transparent p-0 group-data-horizontal/tabs:h-auto">
            {types.map((type) => {
              const Icon = ASSET_ICONS[type];
              return (
                <TabsTrigger
                  key={type}
                  value={type}
                  className="h-8 flex-none rounded-lg border-border bg-card px-3 data-active:border-primary data-active:bg-primary data-active:text-primary-foreground"
                >
                  <Icon className="size-4" />
                  {tStudio(`assets.${type}`)}
                </TabsTrigger>
              );
            })}
          </TabsList>
          {types.map((type) => (
            <TabsContent key={type} value={type}>
              <AssetPanel type={type} asset={output.assets[type]!} generationId={generationId} setTitle={output.title} />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}

function AssetPanel<T extends AssetType>({
  type,
  asset,
  generationId,
  setTitle,
}: {
  type: T;
  asset: AssetOutput[T];
  generationId: string | null;
  setTitle: string;
}) {
  const t = useTranslations("result");
  const tCommon = useTranslations("common");
  const labels = useMarkdownLabels();

  const markdown = () => assetToMarkdown(type, asset, labels);
  const title = assetTitle(type, asset, setTitle);

  return (
    <Card className="gap-5 py-5">
      <CardHeader className="flex flex-row flex-wrap items-center justify-end gap-2 px-5">
        <CopyButton text={markdown} />
        <Button variant="outline" size="sm" onClick={() => downloadText(`${slugify(title)}.md`, markdown())}>
          <Download />
          {tCommon("download")}
        </Button>
        <SaveDraftButton generationId={generationId} assetType={type} title={title} body={markdown} />
      </CardHeader>
      <CardContent className="space-y-5 px-5">
        <AssetBody type={type} asset={asset} />
        <div className="grid grid-cols-1 gap-3 border-t pt-4 sm:grid-cols-2">
          <div className="rounded-lg bg-accent/70 p-3.5">
            <p className="text-xs font-semibold tracking-wide text-accent-foreground uppercase">{t("closingAsk")}</p>
            <p className="mt-1 text-sm">{asset.closing_ask}</p>
          </div>
          <div className="rounded-lg bg-muted p-3.5">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t("takeaway")}</p>
            <p className="mt-1 text-sm">{asset.takeaway}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
