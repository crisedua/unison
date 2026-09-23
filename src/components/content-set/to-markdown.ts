import type { AssetOutput, AssetType } from "@/lib/engine/assets";

/** Interface words used inside copied/downloaded text, in the viewer's language. */
export type MarkdownLabels = {
  subject: string;
  preview: string;
  metaDescription: string;
  hook: string;
  scene: (n: number) => string;
  visual: string;
  voiceover: string;
  onScreenText: string;
  caption: string;
  hashtags: string;
  coverText: string;
  duration: (seconds: number) => string;
  primaryTexts: string;
  option: (n: number) => string;
  headlines: string;
  description: string;
  ctaButton: string;
  cta: (value: AssetOutput["meta_ad"]["cta_button"]) => string;
};

type Scene = AssetOutput["short_script"]["scenes"][number];

function scenes(list: Scene[], l: MarkdownLabels) {
  return list
    .map((s, i) =>
      [
        `## ${l.scene(i + 1)}`,
        `- **${l.visual}:** ${s.visual}`,
        `- **${l.voiceover}:** ${s.voiceover}`,
        s.on_screen_text ? `- **${l.onScreenText}:** ${s.on_screen_text}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n");
}

/** Plain-text/Markdown version of one piece, for copying, downloading and drafts. */
export function assetToMarkdown<T extends AssetType>(type: T, asset: AssetOutput[T], l: MarkdownLabels): string {
  switch (type) {
    case "blog_post": {
      const a = asset as AssetOutput["blog_post"];
      return `# ${a.title}\n\n${a.body_markdown}\n\n---\n${l.metaDescription}: ${a.meta_description}`;
    }
    case "email": {
      const a = asset as AssetOutput["email"];
      return `${l.subject}: ${a.subject}\n${l.preview}: ${a.preview_text}\n\n${a.body}`;
    }
    case "linkedin_post":
      return (asset as AssetOutput["linkedin_post"]).post;
    case "short_script": {
      const a = asset as AssetOutput["short_script"];
      return `# ${a.title} (${l.duration(a.duration_seconds)})\n\n**${l.hook}:** ${a.hook}\n\n${scenes(a.scenes, l)}`;
    }
    case "instagram_reel": {
      const a = asset as AssetOutput["instagram_reel"];
      return [
        `**${l.hook}:** ${a.hook} (${l.duration(a.duration_seconds)})`,
        `**${l.coverText}:** ${a.cover_text}`,
        scenes(a.scenes, l),
        `## ${l.caption}\n${a.caption}`,
        `${l.hashtags}: ${a.hashtags.join(" ")}`,
      ].join("\n\n");
    }
    case "meta_ad": {
      const a = asset as AssetOutput["meta_ad"];
      return [
        `## ${l.primaryTexts}`,
        a.primary_texts.map((text, i) => `### ${l.option(i + 1)}\n${text}`).join("\n\n"),
        `## ${l.headlines}\n${a.headlines.map((h) => `- ${h}`).join("\n")}`,
        `**${l.description}:** ${a.description}\n**${l.ctaButton}:** ${l.cta(a.cta_button)}`,
      ].join("\n\n");
    }
    default:
      return "";
  }
}

/** A short title for a piece saved as a draft. */
export function assetTitle<T extends AssetType>(type: T, asset: AssetOutput[T], fallback: string): string {
  const firstLine = (text: string) => text.split("\n").find((line) => line.trim())?.trim() ?? "";
  const clip = (text: string) => (text.length > 90 ? `${text.slice(0, 87)}…` : text);
  switch (type) {
    case "blog_post":
      return clip((asset as AssetOutput["blog_post"]).title) || fallback;
    case "email":
      return clip((asset as AssetOutput["email"]).subject) || fallback;
    case "linkedin_post":
      return clip(firstLine((asset as AssetOutput["linkedin_post"]).post)) || fallback;
    case "short_script":
      return clip((asset as AssetOutput["short_script"]).title) || fallback;
    case "instagram_reel":
      return clip((asset as AssetOutput["instagram_reel"]).hook) || fallback;
    case "meta_ad":
      return clip((asset as AssetOutput["meta_ad"]).headlines[0] ?? "") || fallback;
    default:
      return fallback;
  }
}

export function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function slugify(text: string) {
  return (
    text
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "unison"
  );
}
