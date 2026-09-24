import { redirect } from "next/navigation";
import { missingRequiredEnv, SetupNotice } from "@/components/setup-notice";

export default async function Home() {
  const missing = missingRequiredEnv();
  if (missing.length > 0) return <SetupNotice kind="env" missing={missing} />;
  redirect("/brain");
}
