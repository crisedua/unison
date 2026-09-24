import "server-only";

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
// Supabase calls the server key "secret" (new projects) or "service_role" (older ones).
// It bypasses row-level security, so it must only ever be read on the server.
export const supabaseSecretKey =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/** False until the Supabase URL and secret key are set. */
export const hasSupabaseEnv = Boolean(supabaseUrl && supabaseSecretKey);
