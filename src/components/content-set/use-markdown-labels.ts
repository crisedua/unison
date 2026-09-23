"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import type { MarkdownLabels } from "./to-markdown";

export function useMarkdownLabels(): MarkdownLabels {
  const t = useTranslations("result");
  const tCta = useTranslations("metaCtas");

  return useMemo(
    () => ({
      subject: t("subject"),
      preview: t("preview"),
      metaDescription: t("metaDescription"),
      hook: t("hook"),
      scene: (number) => t("scene", { number }),
      visual: t("visual"),
      voiceover: t("voiceover"),
      onScreenText: t("onScreenText"),
      caption: t("caption"),
      hashtags: t("hashtags"),
      coverText: t("coverText"),
      duration: (seconds) => t("duration", { seconds }),
      primaryTexts: t("primaryTexts"),
      option: (number) => t("option", { number }),
      headlines: t("headlines"),
      description: t("description"),
      ctaButton: t("ctaButton"),
      cta: (value) => tCta(value),
    }),
    [t, tCta],
  );
}
