"use client";

import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { switchBrand } from "@/app/actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { BrandSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CreateBrandForm } from "./create-brand-form";

export function BrandSwitcher({
  brands,
  activeBrandId,
  className,
}: {
  brands: BrandSummary[];
  activeBrandId: string | null;
  className?: string;
}) {
  const t = useTranslations("nav");
  const tBrand = useTranslations("brand");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const active = brands.find((brand) => brand.id === activeBrandId);

  if (!active) return null;

  function select(brand: BrandSummary) {
    if (brand.id === activeBrandId) return;
    startTransition(async () => {
      const result = await switchBrand(brand.id);
      if (result.ok) toast.success(tBrand("switched", { name: brand.name }));
    });
  }

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg border bg-card px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted",
              pending && "opacity-60",
              className,
            )}
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-accent font-heading text-sm font-bold text-accent-foreground">
              {active.name.charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1 truncate font-medium">{active.name}</span>
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-60">
          <DropdownMenuLabel>{t("brands")}</DropdownMenuLabel>
          {brands.map((brand) => (
            <DropdownMenuItem key={brand.id} onSelect={() => select(brand)}>
              <span className="min-w-0 flex-1 truncate">{brand.name}</span>
              {brand.id === activeBrandId && <Check className="size-4 text-primary" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setDialogOpen(true)}>
            <Plus className="size-4" />
            {t("newBrand")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{tBrand("newTitle")}</DialogTitle>
            <DialogDescription>{tBrand("newBody")}</DialogDescription>
          </DialogHeader>
          <CreateBrandForm />
        </DialogContent>
      </Dialog>
    </>
  );
}
