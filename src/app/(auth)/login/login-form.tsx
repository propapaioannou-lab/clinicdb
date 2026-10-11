"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { ErrorBox, inputClass, primaryButton } from "../ui";
import { loginAction, type LoginState } from "./actions";

export function LoginForm() {
  const t = useTranslations("login");
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, { email: "" });

  return (
    <form action={action} className="space-y-4">
      <label className="block text-sm font-medium">
        {t("email")}
        <input name="email" type="email" autoComplete="username" required autoFocus
          defaultValue={state.email} className={inputClass} />
      </label>
      <label className="block text-sm font-medium">
        {t("password")}
        <input name="password" type="password" autoComplete="current-password" required className={inputClass} />
      </label>
      {state.error && (
        <ErrorBox>{t(`errors.${state.error}`, { minutes: state.minutes ?? 0 })}</ErrorBox>
      )}
      <button type="submit" disabled={pending} className={primaryButton}>
        {pending ? t("submitting") : t("submit")}
      </button>
    </form>
  );
}
