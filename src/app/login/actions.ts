"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { safeNextPath } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";

export type LoginState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "error"; error: "invalid_email" | "send_failed" | "rate_limited" };

async function siteOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (configured) return configured;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function sendMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = z.email().safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!email.success) return { status: "error", error: "invalid_email" };

  const next = safeNextPath(formData.get("next"));
  const redirectTo = `${await siteOrigin()}/auth/callback?next=${encodeURIComponent(next)}`;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.data,
    options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
  });

  if (error) {
    console.error("[sendMagicLink]", error.status, error.message);
    return { status: "error", error: error.status === 429 ? "rate_limited" : "send_failed" };
  }
  return { status: "sent", email: email.data };
}
