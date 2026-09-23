"use client";

import { useTranslations } from "next-intl";
import ReactMarkdown from "react-markdown";
import { Badge } from "@/components/ui/badge";
import type { AssetOutput, AssetType } from "@/lib/engine/assets";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
      <div className="text-sm">{children}</div>
    </div>
  );
}

function Scenes({ scenes }: { scenes: AssetOutput["short_script"]["scenes"] }) {
  const t = useTranslations("result");
  return (
    <ol className="space-y-3">
      {scenes.map((scene, i) => (
        <li key={i} className="rounded-lg border bg-card p-3.5 text-sm">
          <p className="text-xs font-semibold tracking-wide text-primary uppercase">{t("scene", { number: i + 1 })}</p>
          <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-[120px_minmax(0,1fr)]">
            <dt className="text-muted-foreground">{t("visual")}</dt>
            <dd>{scene.visual}</dd>
            <dt className="text-muted-foreground">{t("voiceover")}</dt>
            <dd>{scene.voiceover}</dd>
            {scene.on_screen_text && (
              <>
                <dt className="text-muted-foreground">{t("onScreenText")}</dt>
                <dd className="font-medium">{scene.on_screen_text}</dd>
              </>
            )}
          </dl>
        </li>
      ))}
    </ol>
  );
}

/** The readable version of one piece of a content set. */
export function AssetBody<T extends AssetType>({ type, asset }: { type: T; asset: AssetOutput[T] }) {
  const t = useTranslations("result");
  const tCta = useTranslations("metaCtas");

  switch (type) {
    case "blog_post": {
      const a = asset as AssetOutput["blog_post"];
      return (
        <article className="space-y-4">
          <h3 className="text-2xl leading-tight font-bold">{a.title}</h3>
          <div className="markdown text-[15px] leading-relaxed">
            <ReactMarkdown>{a.body_markdown}</ReactMarkdown>
          </div>
          <Field label={t("metaDescription")}>
            <p className="text-muted-foreground">{a.meta_description}</p>
          </Field>
        </article>
      );
    }
    case "email": {
      const a = asset as AssetOutput["email"];
      return (
        <div className="overflow-hidden rounded-lg border bg-card">
          <div className="space-y-2 border-b bg-muted/40 px-4 py-3 text-sm">
            <p>
              <span className="text-muted-foreground">{t("subject")}: </span>
              <span className="font-semibold">{a.subject}</span>
            </p>
            <p>
              <span className="text-muted-foreground">{t("preview")}: </span>
              {a.preview_text}
            </p>
          </div>
          <div className="px-4 py-4 text-[15px] leading-relaxed whitespace-pre-wrap">{a.body}</div>
        </div>
      );
    }
    case "linkedin_post": {
      const a = asset as AssetOutput["linkedin_post"];
      return (
        <div className="rounded-lg border bg-card px-5 py-4 text-[15px] leading-relaxed whitespace-pre-wrap">
          {a.post}
        </div>
      );
    }
    case "short_script": {
      const a = asset as AssetOutput["short_script"];
      return (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold">{a.title}</h3>
            <Badge variant="secondary">{t("duration", { seconds: a.duration_seconds })}</Badge>
          </div>
          <Field label={t("hook")}>
            <p className="font-medium">{a.hook}</p>
          </Field>
          <Scenes scenes={a.scenes} />
        </div>
      );
    }
    case "instagram_reel": {
      const a = asset as AssetOutput["instagram_reel"];
      return (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{t("duration", { seconds: a.duration_seconds })}</Badge>
            <Badge variant="outline">
              {t("coverText")}: {a.cover_text}
            </Badge>
          </div>
          <Field label={t("hook")}>
            <p className="font-medium">{a.hook}</p>
          </Field>
          <Scenes scenes={a.scenes} />
          <Field label={t("caption")}>
            <p className="whitespace-pre-wrap">{a.caption}</p>
          </Field>
          <Field label={t("hashtags")}>
            <div className="flex flex-wrap gap-1.5">
              {a.hashtags.map((tag) => (
                <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                  {tag}
                </span>
              ))}
            </div>
          </Field>
        </div>
      );
    }
    case "meta_ad": {
      const a = asset as AssetOutput["meta_ad"];
      return (
        <div className="space-y-5">
          <Field label={t("primaryTexts")}>
            <div className="grid grid-cols-1 gap-3">
              {a.primary_texts.map((text, i) => (
                <div key={i} className="rounded-lg border bg-card p-3.5">
                  <p className="text-xs font-semibold text-primary">{t("option", { number: i + 1 })}</p>
                  <p className="mt-1 whitespace-pre-wrap">{text}</p>
                </div>
              ))}
            </div>
          </Field>
          <Field label={t("headlines")}>
            <ul className="space-y-1.5">
              {a.headlines.map((headline, i) => (
                <li key={i} className="rounded-md bg-muted px-3 py-1.5 font-medium">
                  {headline}
                </li>
              ))}
            </ul>
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("description")}>{a.description}</Field>
            <Field label={t("ctaButton")}>
              <span className="inline-flex rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                {tCta(a.cta_button)}
              </span>
            </Field>
          </div>
        </div>
      );
    }
    default:
      return null;
  }
}
