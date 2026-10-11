"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { ErrorBox, secondaryButton } from "@/components/ui";
import type { FormState } from "../../actions";
import { PasswordReveal } from "../../password-reveal";

export function GeneratePassword({ action }: { action: (prev: FormState) => Promise<FormState> }) {
  const t = useTranslations("admin");
  const [state, formAction, pending] = useActionState<FormState>(action, {});
  if (state.password) return <PasswordReveal password={state.password} />;
  return (
    <form action={formAction}>
      <button type="submit" disabled={pending} className={secondaryButton}
        onClick={(e) => { if (!window.confirm(t("detail.generateConfirm"))) e.preventDefault(); }}>
        {t("detail.generate")}
      </button>
      {state.error && <ErrorBox>{t(`errors.${state.error}`)}</ErrorBox>}
    </form>
  );
}
