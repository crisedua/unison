"use client";

import { useLocale } from "next-intl";
import { useTransition } from "react";
import { setLocale } from "@/app/actions";
import { locales } from "@/i18n/config";
import { cn } from "@/lib/utils";

/** EN | ES toggle for the interface language. */
export function LanguageSwitcher({ className }: { className?: string }) {
  const current = useLocale();
  const [pending, startTransition] = useTransition();

  return (
    <div
      className={cn("inline-flex rounded-lg bg-muted p-0.5 text-xs font-medium", pending && "opacity-60", className)}
      role="group"
      aria-label="Language / Idioma"
    >
      {locales.map((locale) => (
        <button
          key={locale}
          type="button"
          disabled={pending}
          aria-pressed={locale === current}
          onClick={() => startTransition(() => setLocale(locale))}
          className={cn(
            "rounded-md px-2.5 py-1 uppercase transition-colors",
            locale === current ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {locale}
        </button>
      ))}
    </div>
  );
}
