import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasSupabaseEnv, supabaseKey, supabaseUrl } from "./env";

/**
 * Refreshes the session cookie and gives first-time visitors an anonymous
 * Supabase session, so there is no login screen. Each browser gets its own
 * workspace; row-level security still keeps workspaces apart.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Until Supabase is configured, pages render a setup screen instead.
  if (!hasSupabaseEnv) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Do not run code between createServerClient and getClaims(): the call
  // refreshes the session, and skipping it drops sessions at random.
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) {
    const { error } = await supabase.auth.signInAnonymously();
    // The app layout shows a setup notice when this fails (anonymous sign-ins turned off).
    if (error) console.error("[proxy] anonymous sign-in failed:", error.status, error.message);
  }

  return response;
}
