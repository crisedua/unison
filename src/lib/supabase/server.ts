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
    // Next.js memoizes identical GET fetches within one render; a database read
    // must always be fresh (e.g. re-reading after a write), so opt out with a signal.
    global: {
      fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ?? new AbortController().signal }),
    },
  });
}
