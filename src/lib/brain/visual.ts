import "server-only";
import type { Supabase } from "./queries";

/** How generated images should look. Empty fields mean "let the AI choose". */
export type VisualStyle = { colors: string; look: string; avoid: string };

export const EMPTY_VISUAL_STYLE: VisualStyle = { colors: "", look: "", avoid: "" };
export const VISUAL_FIELD_MAX_LENGTH = 1000;

/** Postgres "undefined column": migration 0003 hasn't been run on this database yet. */
export function isMissingColumn(error: { code?: string; message?: string } | null) {
  return Boolean(error && (error.code === "42703" || /visual_\w+.*does not exist/i.test(error.message ?? "")));
}

/**
 * The brand's visual style. `available` is false until migration 0003 adds the
 * columns, so the rest of the app keeps working on an older database.
 */
export async function loadVisualStyle(
  supabase: Supabase,
  brandId: string,
): Promise<{ available: boolean; style: VisualStyle }> {
  const { data, error } = await supabase
    .from("unison_brands")
    .select("visual_colors, visual_look, visual_avoid")
    .eq("id", brandId)
    .maybeSingle();
  if (isMissingColumn(error)) return { available: false, style: EMPTY_VISUAL_STYLE };
  if (error) throw new Error(`Could not load visual style: ${error.message}`);
  return {
    available: true,
    style: {
      colors: (data?.visual_colors as string | undefined) ?? "",
      look: (data?.visual_look as string | undefined) ?? "",
      avoid: (data?.visual_avoid as string | undefined) ?? "",
    },
  };
}
