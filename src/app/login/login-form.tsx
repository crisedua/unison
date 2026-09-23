"use client";

import { MailCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendMagicLink, type LoginState } from "./actions";

type Props = { next: string; linkError: boolean };

export function LoginForm(props: Props) {
  // Changing the key resets the form after "Use a different email".
  const [attempt, setAttempt] = useState(0);
  return <EmailForm key={attempt} {...props} onReset={() => setAttempt((n) => n + 1)} />;
}

function EmailForm({ next, linkError, onReset }: Props & { onReset: () => void }) {
  const t = useTranslations("login");
  const [state, formAction, pending] = useActionState<LoginState, FormData>(sendMagicLink, { status: "idle" });

  if (state.status === "sent") {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <MailCheck className="size-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-bold">{t("sentTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("sentBody", { email: state.email })}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onReset}>
          {t("useAnother")}
        </Button>
      </div>
    );
  }

  const error = state.status === "error" ? state.error : linkError ? "link" : null;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div className="space-y-2">
        <Label htmlFor="email">{t("emailLabel")}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          autoFocus
          placeholder={t("emailPlaceholder")}
          className="h-10"
          aria-invalid={error === "invalid_email" || undefined}
        />
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {t(`errors.${error}`)}
        </p>
      )}
      <Button type="submit" className="h-10 w-full" disabled={pending}>
        {pending ? t("sending") : t("submit")}
      </Button>
    </form>
  );
}
