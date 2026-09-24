import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { supabaseSecretKey, supabaseUrl } from "./env";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 * There is no login: it uses the secret key, which skips row-level security,
 * so every query must stay scoped to the workspace from `getReadyContext()`.
 */
export async function createClient() {
  return createSupabaseClient(supabaseUrl, supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
