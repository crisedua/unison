import { AppShell } from "@/components/app-shell/app-shell";
import { missingRequiredEnv, SetupNotice } from "@/components/setup-notice";
import { getAppContext } from "@/lib/context";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAppContext();

  if (ctx.status === "env_missing") return <SetupNotice kind="env" missing={missingRequiredEnv()} />;
  if (ctx.status === "no_session") return <SetupNotice kind="anonymous" />;
  if (ctx.status === "database_not_ready") return <SetupNotice kind="database" message={ctx.message} />;

  return <AppShell ctx={ctx}>{children}</AppShell>;
}
