import { LanguageSwitcher } from "@/components/language-switcher";
import { Logo } from "@/components/logo";
import type { ReadyContext } from "@/lib/context";
import { BrandSwitcher } from "./brand-switcher";
import { NavLinks } from "./nav-links";

export function AppShell({ ctx, children }: { ctx: ReadyContext; children: React.ReactNode }) {
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
        <div className="mt-auto flex justify-end border-t px-2 pt-4">
          <LanguageSwitcher />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 space-y-3 border-b bg-sidebar/95 px-4 py-3 backdrop-blur md:hidden">
          <div className="flex items-center justify-between gap-3">
            <Logo />
            <LanguageSwitcher />
          </div>
          <BrandSwitcher brands={ctx.brands} activeBrandId={activeBrandId} />
          <NavLinks variant="mobile" />
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-10">{children}</main>
      </div>
    </div>
  );
}
