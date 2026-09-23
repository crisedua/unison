import { cn } from "@/lib/utils";
import { siteConfig } from "@/config/site";

/** Two overlapping voices: the product mark. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-7 shrink-0", className)}>
      <circle cx="12.5" cy="16" r="7.5" className="fill-primary" />
      <circle cx="19.5" cy="16" r="7.5" className="fill-primary" fillOpacity={0.45} />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-heading text-lg font-bold tracking-tight", className)}>
      <LogoMark />
      {siteConfig.name}
    </span>
  );
}
