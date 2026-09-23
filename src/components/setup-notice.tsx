import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/logo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = { kind: "env"; missing: string[] } | { kind: "database"; message: string };

const REQUIRED_ENV = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"] as const;

export function missingRequiredEnv() {
  return REQUIRED_ENV.filter((key) => !process.env[key]);
}

/** Shown instead of the app until the keys and database are set up. */
export async function SetupNotice(props: Props) {
  const t = await getTranslations("setup");
  const code = props.kind === "env" ? props.missing.map((key) => `${key}=`).join("\n") : "npm run db:migrate";

  return (
    <div className="bg-grid flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-lg gap-5 py-6">
        <CardHeader className="gap-4 px-6">
          <Logo />
          <CardTitle className="text-xl font-bold">
            {props.kind === "env" ? t("envTitle") : t("databaseTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 px-6 leading-relaxed">
          <p>{props.kind === "env" ? t("envBody") : t("databaseBody")}</p>
          <pre className="overflow-x-auto rounded-lg bg-muted px-4 py-3 font-mono text-xs">{code}</pre>
          {props.kind === "database" && (
            <p className="text-xs text-muted-foreground">{t("details", { message: props.message })}</p>
          )}
          <p className="text-muted-foreground">{t("readme")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
