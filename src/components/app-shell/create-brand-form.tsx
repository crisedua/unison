"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState } from "react";
import { createBrand, type CreateBrandState } from "@/app/(app)/brain/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CONTENT_LANGUAGES } from "@/lib/languages";

export function CreateBrandForm() {
  const t = useTranslations("brand");
  const tLanguages = useTranslations("languages");
  const locale = useLocale();
  const [state, formAction, pending] = useActionState<CreateBrandState, FormData>(createBrand, {});

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="brand-name">{t("nameLabel")}</Label>
        <Input
          id="brand-name"
          name="name"
          required
          maxLength={80}
          autoFocus
          placeholder={t("namePlaceholder")}
          className="h-10"
          aria-invalid={state.error === "name" || undefined}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="brand-language">{t("languageLabel")}</Label>
        <Select name="content_language" defaultValue={locale === "es" ? "es-419" : "en-US"}>
          <SelectTrigger id="brand-language" className="h-10 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CONTENT_LANGUAGES.map((language) => (
              <SelectItem key={language} value={language}>
                {tLanguages(language)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{t("languageHelp")}</p>
      </div>
      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {t(`errors.${state.error}`)}
        </p>
      )}
      <Button type="submit" className="h-10 w-full" disabled={pending}>
        {pending ? t("creating") : t("create")}
      </Button>
    </form>
  );
}
