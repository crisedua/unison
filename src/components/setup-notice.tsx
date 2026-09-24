import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/logo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabaseKey, supabaseUrl } from "@/lib/supabase/env";

type Props =
  | { kind: "env"; missing: string[] }
  | { kind: "database"; message: string }
  | { kind: "anonymous"; message: string };

const COPY = {
  env: { title: "envTitle", body: "envBody" },
  database: { title: "databaseTitle", body: "databaseBody" },
  anonymous: { title: "anonymousTitle", body: "anonymousBody" },
} as const;

export function missingRequiredEnv() {
  const missing: string[] = [];
  if (!supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!supabaseKey) missing.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  return missing;
}

/** Shown instead of the app until the keys and database are set up. */
export async function SetupNotice(props: Props) {
  const t = await getTranslations("setup");
  const code =
    props.kind === "env"
      ? props.missing.map((key) => `${key}=`).join("\n")
      : props.kind === "database"
        ? "npm run db:migrate"
        : "Authentication\n→ Sign In / Providers\n→ Allow anonymous sign-ins";

  return (
    <div className="bg-grid flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-lg gap-5 py-6">
        <CardHeader className="gap-4 px-6">
          <Logo />
          <CardTitle className="text-xl font-bold">
            {t(COPY[props.kind].title)}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 px-6 leading-relaxed">
          <p>{t(COPY[props.kind].body)}</p>
          <pre className="overflow-x-auto rounded-lg bg-muted px-4 py-3 font-mono text-xs">{code}</pre>
          {props.kind !== "env" && (
            <p className="text-xs text-muted-foreground">{t("details", { message: props.message })}</p>
          )}
          <p className="text-muted-foreground">{t("readme")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
