"use client";

import { Check, Palette } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { VisualStyle } from "@/lib/brain/visual";
import { saveVisualStyle } from "./actions";

const FIELDS = ["colors", "look", "avoid"] as const;

/** Visual style for generated images. Saved on its own, separately from the written brain. */
export function VisualStyleCard({
  brandId,
  initial,
  available,
}: {
  brandId: string;
  initial: VisualStyle;
  available: boolean;
}) {
  const t = useTranslations("brain.visual");
  const tCommon = useTranslations("common");
  const [values, setValues] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [needsUpdate, setNeedsUpdate] = useState(!available);
  const [pending, startTransition] = useTransition();
  const dirty = JSON.stringify(values) !== JSON.stringify(saved);

  function save() {
    const snapshot = values;
    startTransition(async () => {
      const result = await saveVisualStyle(brandId, snapshot);
      if (result.ok) {
        setSaved(snapshot);
        toast.success(t("saved"));
      } else if (result.error === "needs_update") {
        setNeedsUpdate(true);
      } else {
        toast.error(tCommon("error"));
      }
    });
  }

  return (
    <Card id="visual" className="scroll-mt-24 gap-4 py-5">
      <CardHeader className="px-5">
        <CardTitle className="flex items-center gap-2 font-bold">
          <Palette className="size-4 text-primary" />
          {t("title")}
        </CardTitle>
        <CardDescription>{t("help")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 px-5">
        {needsUpdate && (
          <Alert className="border-warning-foreground/20 bg-warning text-warning-foreground">
            <AlertTitle>{t("needsUpdateTitle")}</AlertTitle>
            <AlertDescription className="text-warning-foreground/90">{t("needsUpdateBody")}</AlertDescription>
          </Alert>
        )}
        {FIELDS.map((key) => (
          <div key={key} className="space-y-2">
            <Label htmlFor={`visual-${key}`}>{t(`${key}.label`)}</Label>
            <Textarea
              id={`visual-${key}`}
              value={values[key]}
              maxLength={1000}
              disabled={needsUpdate}
              placeholder={t(`${key}.placeholder`)}
              onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
              className="min-h-14 bg-card"
            />
          </div>
        ))}
        <div className="flex justify-end">
          <Button onClick={save} disabled={!dirty || pending || needsUpdate}>
            <Check />
            {pending ? tCommon("saving") : t("save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
