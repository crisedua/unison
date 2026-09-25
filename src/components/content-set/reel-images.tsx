"use client";

import { Download, ImagePlus, Loader2, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { createReelImages, getReelImages, type ReelImagesResult } from "@/app/(app)/media/actions";
import { ActionError } from "@/components/action-error";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { SignedMedia } from "@/lib/media/storage";

type ImagesError = Extract<ReelImagesResult, { ok: false }>["error"];

/** Cover + one image per scene for a saved Reel: create, view and download. */
export function ReelImages({ generationId, sceneCount }: { generationId: string; sceneCount: number }) {
  const t = useTranslations("reelImages");
  const [images, setImages] = useState<SignedMedia[] | null>(null);
  const [error, setError] = useState<ImagesError | null>(null);
  const [failed, setFailed] = useState(0);
  const [pending, startTransition] = useTransition();
  const total = sceneCount + 1;

  useEffect(() => {
    let active = true;
    getReelImages(generationId)
      .then((result) => {
        if (active) setImages(result.ok ? result.images : []);
      })
      .catch(() => active && setImages([]));
    return () => {
      active = false;
    };
  }, [generationId]);

  function create() {
    if (images?.length && !window.confirm(t("confirmRedo"))) return;
    startTransition(async () => {
      setError(null);
      setFailed(0);
      try {
        const result = await createReelImages(generationId);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setImages(result.images);
        setFailed(result.failed);
      } catch {
        setError({ code: "ai_failed" });
      }
    });
  }

  const has = (images?.length ?? 0) > 0;

  return (
    <div className="space-y-3 border-t pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t("title")}</p>
          <p className="text-sm text-muted-foreground">{t("help", { count: total })}</p>
        </div>
        <Button variant={has ? "outline" : "default"} size="sm" onClick={create} disabled={pending || images === null}>
          {pending ? <Loader2 className="animate-spin" /> : has ? <RefreshCw /> : <ImagePlus />}
          {pending ? t("creating") : has ? t("redo") : t("create", { count: total })}
        </Button>
      </div>

      {pending && <p className="text-sm text-muted-foreground">{t("wait")}</p>}
      {error && <ActionError error={error} />}
      {failed > 0 && !pending && <p className="text-sm text-destructive">{t("someFailed", { count: failed })}</p>}

      {pending ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: total }, (_, i) => (
            <Skeleton key={i} className="aspect-[9/16] w-full rounded-lg" />
          ))}
        </div>
      ) : (
        has && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {images!.map((image) => (
              <figure key={image.name} className="space-y-1.5">
                <a href={image.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border">
                  {/* Signed Supabase URLs expire, so Next's image optimizer isn't used here. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image.url} alt={label(t, image.name)} className="aspect-[9/16] w-full object-cover" />
                </a>
                <figcaption className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">{label(t, image.name)}</span>
                  <a
                    href={image.downloadUrl}
                    className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                  >
                    <Download className="size-3" />
                    {t("download")}
                  </a>
                </figcaption>
              </figure>
            ))}
          </div>
        )
      )}
    </div>
  );
}

function label(t: ReturnType<typeof useTranslations<"reelImages">>, name: string) {
  if (name.startsWith("cover")) return t("cover");
  const n = Number(name.match(/scene-(\d+)/)?.[1] ?? 0);
  return t("scene", { n });
}
