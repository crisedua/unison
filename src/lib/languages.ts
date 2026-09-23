// Languages the AI can write content in (separate from the interface language).
export const CONTENT_LANGUAGES = ["en-US", "en-GB", "es-419", "es-MX", "es-ES"] as const;
export type ContentLanguage = (typeof CONTENT_LANGUAGES)[number];

export const DEFAULT_CONTENT_LANGUAGE: ContentLanguage = "en-US";

export function isContentLanguage(value: unknown): value is ContentLanguage {
  return typeof value === "string" && (CONTENT_LANGUAGES as readonly string[]).includes(value);
}

/** How each language is described to the model. */
export const CONTENT_LANGUAGE_PROMPT: Record<ContentLanguage, string> = {
  "en-US": "English (United States). American spelling and idiom.",
  "en-GB": "English (United Kingdom). British spelling and idiom.",
  "es-419":
    "Spanish (Latin America, neutral). Use “tú”. Avoid Spain-only words and forms (vosotros, vale, ordenador, coger).",
  "es-MX": "Spanish (Mexico). Use “tú” and natural Mexican vocabulary, without heavy slang.",
  "es-ES": "Spanish (Spain). Use “tú” and “vosotros” where natural, with Spain vocabulary.",
};
