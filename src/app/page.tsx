import { redirect } from "next/navigation";
import { missingRequiredEnv, SetupNotice } from "@/components/setup-notice";
import { createClient } from "@/lib/supabase/server";

export default async function Home({ searchParams }: PageProps<"/">) {
  const missing = missingRequiredEnv();
  if (missing.length > 0) return <SetupNotice kind="env" missing={missing} />;

  // If Supabase sends the login link to the site root, finish the login here.
  const { code } = await searchParams;
  if (typeof code === "string") {
    redirect(`/auth/callback?code=${encodeURIComponent(code)}`);
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  redirect(data?.claims ? "/brain" : "/login");
}
