import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { BrandSummary } from "@/lib/types";

export const ACTIVE_BRAND_COOKIE = "active_brand";

// Owner of the shared workspace when the database has none yet. Tables keep
// a `created_by` that points at a Supabase user, so one is created for it.
const OWNER_EMAIL = "owner@unison.example.com";

export type ReadyContext = {
  status: "ready";
  userId: string;
  workspaceId: string;
  brands: BrandSummary[];
  activeBrand: BrandSummary | null;
};

export type AppContext =
  | ReadyContext
  | { status: "env_missing" }
  | { status: "database_not_ready"; message: string };

type Supabase = Awaited<ReturnType<typeof createClient>>;
type Workspace = { id: string; created_by: string };

async function firstWorkspace(supabase: Supabase) {
  return supabase
    .from("unison_workspaces")
    .select("id, created_by")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<Workspace>();
}

async function ownerUserId(supabase: Supabase): Promise<string> {
  const created = await supabase.auth.admin.createUser({ email: OWNER_EMAIL, email_confirm: true });
  if (created.data.user) return created.data.user.id;

  // Already created by an earlier request.
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const existing = data?.users.find((user) => user.email === OWNER_EMAIL);
  if (!existing) throw new Error(created.error?.message ?? error?.message ?? "Couldn't create the owner user");
  return existing.id;
}

/** The oldest workspace (so data from the old email login is kept), created on first use. */
async function sharedWorkspace(supabase: Supabase): Promise<Workspace> {
  const found = await firstWorkspace(supabase);
  if (found.error) throw new Error(found.error.message);
  if (found.data) return found.data;

  const owner = await ownerUserId(supabase);
  const { data: workspace, error } = await supabase
    .from("unison_workspaces")
    .insert({ name: "My workspace", created_by: owner })
    .select("id, created_by")
    .single<Workspace>();
  if (error) throw new Error(error.message);

  const member = await supabase
    .from("unison_workspace_members")
    .insert({ workspace_id: workspace.id, user_id: owner, role: "owner" });
  if (member.error) throw new Error(member.error.message);

  // Two first requests at once can both create one; everyone uses the oldest.
  const oldest = await firstWorkspace(supabase);
  return oldest.data ?? workspace;
}

/**
 * The shared workspace and the brand being worked on. There is no login:
 * everyone who opens the app works in the same workspace. Cached per request.
 */
export const getAppContext = cache(async (): Promise<AppContext> => {
  if (!hasSupabaseEnv) return { status: "env_missing" };

  const supabase = await createClient();
  let workspace: Workspace;
  try {
    workspace = await sharedWorkspace(supabase);
  } catch (error) {
    return { status: "database_not_ready", message: error instanceof Error ? error.message : "No workspace" };
  }

  const { data: brands, error: brandsError } = await supabase
    .from("unison_brands")
    .select("id, name, content_language")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: true });
  if (brandsError) {
    return { status: "database_not_ready", message: brandsError.message };
  }

  const list = (brands ?? []) as BrandSummary[];
  const activeId = (await cookies()).get(ACTIVE_BRAND_COOKIE)?.value;
  const activeBrand = list.find((b) => b.id === activeId) ?? list[0] ?? null;

  return {
    status: "ready",
    userId: workspace.created_by,
    workspaceId: workspace.id,
    brands: list,
    activeBrand,
  };
});

/** For pages and actions: the ready context, or null while the database isn't set up. */
export async function getReadyContext(): Promise<ReadyContext | null> {
  const ctx = await getAppContext();
  return ctx.status === "ready" ? ctx : null;
}
