"use client";

import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { FactKey } from "@/lib/brain/facts";

type ErrorCode =
  | "missing_facts"
  | "ai_not_configured"
  | "ai_key_invalid"
  | "ai_quota"
  | "ai_rate_limited"
  | "ai_unreachable"
  | "ai_model_unavailable"
  | "ai_incomplete"
  | "ai_refused"
  | "ai_failed"
  | "invalid_input"
  | "not_ready"
  | "not_found"
  | "save_failed"
  | "needs_notes";

/** The error a studio action returned, with a link to the Company Brain when facts are missing. */
export function ActionError({ error }: { error: { code: ErrorCode; missing?: FactKey[] } }) {
  const tErrors = useTranslations("errors");
  const tFacts = useTranslations("facts");
  const tStudio = useTranslations("studio");

  return (
    <Alert variant="destructive" className="py-3">
      <TriangleAlert />
      <AlertTitle>{tErrors(error.code)}</AlertTitle>
      {error.code === "missing_facts" && error.missing && (
        <AlertDescription>
          {error.missing.map((key) => tFacts(key)).join(", ")} · <Link href="/brain">{tStudio("goToBrain")}</Link>
        </AlertDescription>
      )}
    </Alert>
  );
}

/** Shown before generating when the Company Brain lacks facts the output needs. */
export function MissingFactsNotice({ missing }: { missing: FactKey[] }) {
  const t = useTranslations("studio");
  const tFacts = useTranslations("facts");

  return (
    <div className="space-y-2 rounded-lg border border-warning-foreground/20 bg-warning p-3 text-sm text-warning-foreground">
      <p className="font-medium">{t("missingTitle")}</p>
      <p>
        {t("missingBody")} {missing.map((key) => tFacts(key)).join(", ")}
      </p>
      <Link href="/brain" className="inline-block font-medium underline underline-offset-2">
        {t("goToBrain")}
      </Link>
    </div>
  );
}

/** Warning shown at the top of a studio when OPENAI_API_KEY isn't set. */
export function AiMissingAlert() {
  const t = useTranslations("studio");
  return (
    <Alert className="mb-6 border-warning-foreground/20 bg-warning text-warning-foreground">
      <TriangleAlert />
      <AlertTitle>{t("aiMissingTitle")}</AlertTitle>
      <AlertDescription className="text-warning-foreground/90">{t("aiMissingBody")}</AlertDescription>
    </Alert>
  );
}
