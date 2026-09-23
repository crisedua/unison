import { LogOut } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { signOut } from "@/app/actions";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import type { ReadyContext } from "@/lib/context";
import { BrandSwitcher } from "./brand-switcher";
import { NavLinks } from "./nav-links";

export async function AppShell({ ctx, children }: { ctx: ReadyContext; children: React.ReactNode }) {
  const t = await getTranslations("nav");
  const activeBrandId = ctx.activeBrand?.id ?? null;

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r bg-sidebar px-3 py-5 md:flex">
        <div className="px-2">
          <Logo />
        </div>
        <BrandSwitcher brands={ctx.brands} activeBrandId={activeBrandId} className="mt-6" />
        <div className="mt-6">
          <NavLinks />
        </div>
        <div className="mt-auto space-y-3 border-t pt-4">
          <div className="flex items-center justify-between gap-2 px-2">
            <span className="min-w-0 truncate text-xs text-muted-foreground" title={ctx.email}>
              {ctx.email}
            </span>
            <LanguageSwitcher />
          </div>
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm" className="w-full justify-start text-muted-foreground">
              <LogOut />
              {t("signOut")}
            </Button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 space-y-3 border-b bg-sidebar/95 px-4 py-3 backdrop-blur md:hidden">
          <div className="flex items-center justify-between gap-3">
            <Logo />
            <div className="flex items-center gap-2">
              <LanguageSwitcher />
              <form action={signOut}>
                <Button type="submit" variant="ghost" size="icon-sm" aria-label={t("signOut")}>
                  <LogOut />
                </Button>
              </form>
            </div>
          </div>
          <BrandSwitcher brands={ctx.brands} activeBrandId={activeBrandId} />
          <NavLinks variant="mobile" />
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-10">{children}</main>
      </div>
    </div>
  );
}
