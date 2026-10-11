"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { ErrorBox, inputClass, primaryButton } from "@/components/ui";
import { TrustCheckbox } from "../trust-checkbox";
import { verifyCodeAction, type CodeState } from "../two-factor-actions";

export function CodeForm({ trustDays }: { trustDays: number }) {
  const t = useTranslations("twoFactor");
  const [state, action, pending] = useActionState<CodeState, FormData>(verifyCodeAction, {});

  return (
    <form action={action} className="space-y-4">
      <p className="text-sm text-neutral-600 dark:text-neutral-400">{t("intro")}</p>
      <label className="block text-sm font-medium">
        {t("code")}
        <input name="code" autoComplete="one-time-code" autoFocus required maxLength={20}
          className={`${inputClass} tracking-widest`} />
      </label>
      <p className="text-xs text-neutral-500">{t("recoveryHint")}</p>
      <TrustCheckbox days={trustDays} />
      {state.error && <ErrorBox>{t(`errors.${state.error}`, { minutes: state.minutes ?? 0 })}</ErrorBox>}
      <button type="submit" disabled={pending} className={`${primaryButton} w-full`}>
        {pending ? t("submitting") : t("submit")}
      </button>
    </form>
  );
}
