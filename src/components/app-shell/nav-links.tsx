"use client";

import { Brain, ChartLine, Handshake, Library, Megaphone, PenLine, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

type NavKey = "brain" | "studio" | "library" | "campaigns" | "sales" | "results";

const ITEMS: { key: NavKey; href: string | null; icon: LucideIcon }[] = [
  { key: "brain", href: "/brain", icon: Brain },
  { key: "studio", href: "/studio", icon: PenLine },
  { key: "library", href: "/library", icon: Library },
  { key: "campaigns", href: "/campaigns", icon: Megaphone },
  { key: "sales", href: "/sales", icon: Handshake },
  { key: "results", href: "/results", icon: ChartLine },
];

function isActive(pathname: string, href: string) {
  if (href === "/library") return pathname.startsWith("/library") || pathname.startsWith("/drafts");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLinks({ variant = "sidebar" }: { variant?: "sidebar" | "mobile" }) {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const pathname = usePathname();
  const mobile = variant === "mobile";

  return (
    <nav className={cn(mobile ? "flex gap-1 overflow-x-auto" : "flex flex-col gap-0.5")}>
      {ITEMS.filter((item) => !mobile || item.href).map(({ key, href, icon: Icon }) => {
        const content = (
          <>
            <Icon className="size-4 shrink-0" />
            <span className="truncate">{t(key)}</span>
            {!href && (
              <span className="ml-auto rounded-full bg-muted px-1.5 py-px text-[10px] font-medium uppercase">
                {tCommon("soon")}
              </span>
            )}
          </>
        );
        const base = "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm whitespace-nowrap transition-colors";

        if (!href) {
          return (
            <span key={key} className={cn(base, "cursor-default text-muted-foreground/70")} aria-disabled>
              {content}
            </span>
          );
        }
        const active = isActive(pathname, href);
        return (
          <Link
            key={key}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              base,
              active
                ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-muted",
            )}
          >
            {content}
          </Link>
        );
      })}
    </nav>
  );
}
