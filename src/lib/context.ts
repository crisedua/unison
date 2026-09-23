import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { BrandSummary } from "@/lib/types";

export const ACTIVE_BRAND_COOKIE = "active_brand";

export type ReadyContext = {
  status: "ready";
  userId: string;
  email: string;
  workspaceId: string;
  brands: BrandSummary[];
  activeBrand: BrandSummary | null;
};

export type AppContext =
  | ReadyContext
  | { status: "env_missing" }
  | { status: "database_not_ready"; message: string };

/**
 * The logged-in user, their workspace and the brand they're working on.
 * Redirects to /login when nobody is logged in. Cached per request.
 */
export const getAppContext = cache(async (): Promise<AppContext> => {
  if (!hasSupabaseEnv) return { status: "env_missing" };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const claims = auth?.claims;
  if (!claims) {
    redirect("/login");
  }

  const { data: workspaceId, error } = await supabase.rpc("unison_ensure_personal_workspace");
  if (error || typeof workspaceId !== "string") {
    return { status: "database_not_ready", message: error?.message ?? "No workspace" };
  }

  const { data: brands, error: brandsError } = await supabase
    .from("unison_brands")
    .select("id, name, content_language")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });
  if (brandsError) {
    return { status: "database_not_ready", message: brandsError.message };
  }

  const list = (brands ?? []) as BrandSummary[];
  const activeId = (await cookies()).get(ACTIVE_BRAND_COOKIE)?.value;
  const activeBrand = list.find((b) => b.id === activeId) ?? list[0] ?? null;

  return {
    status: "ready",
    userId: claims.sub,
    email: typeof claims.email === "string" ? claims.email : "",
    workspaceId,
    brands: list,
    activeBrand,
  };
});

/** For pages and actions: the ready context, or null while the database isn't set up. */
export async function getReadyContext(): Promise<ReadyContext | null> {
  const ctx = await getAppContext();
  return ctx.status === "ready" ? ctx : null;
}
