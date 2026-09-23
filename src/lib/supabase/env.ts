export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
// Supabase calls the same client key "publishable" (new projects) or "anon" (older ones).
export const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** False until the Supabase keys are added to .env.local. */
export const hasSupabaseEnv = Boolean(supabaseUrl && supabaseKey);
