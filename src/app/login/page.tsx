import { Check } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Logo } from "@/components/logo";
import { missingRequiredEnv, SetupNotice } from "@/components/setup-notice";
import { siteConfig } from "@/config/site";
import { safeNextPath } from "@/lib/safe-next";
import { LoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("login");
  return { title: t("title", { name: siteConfig.name }) };
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const missing = missingRequiredEnv();
  if (missing.length > 0) return <SetupNotice kind="env" missing={missing} />;

  const params = await searchParams;
  const next = safeNextPath(params.next);
  const linkError = typeof params.error === "string";
  const t = await getTranslations("login");

  return (
    <div className="bg-grid grid min-h-screen grid-cols-1 lg:grid-cols-2">
      <section className="hidden flex-col justify-between border-r bg-card/60 p-12 lg:flex">
        <Logo />
        <div className="max-w-md space-y-6">
          <h1 className="text-5xl leading-[1.05] font-extrabold">{t("heroTitle")}</h1>
          <p className="text-lg leading-relaxed text-muted-foreground">{t("heroBody", { name: siteConfig.name })}</p>
          <ul className="space-y-3 text-sm">
            {(["point1", "point2", "point3"] as const).map((key) => (
              <li key={key} className="flex items-start gap-2.5">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                {t(key)}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} {siteConfig.name}</p>
      </section>

      <section className="flex flex-col p-6">
        <div className="flex items-center justify-between">
          <Logo className="lg:invisible" />
          <LanguageSwitcher />
        </div>
        <div className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-sm space-y-8 rounded-2xl bg-card p-8 shadow-sm ring-1 ring-foreground/10">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">{t("title", { name: siteConfig.name })}</h2>
              <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
            </div>
            <LoginForm next={next} linkError={linkError} />
          </div>
        </div>
      </section>
    </div>
  );
}
