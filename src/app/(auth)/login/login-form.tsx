"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { loginAction, type LoginState } from "./actions";

const input =
  "mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-900 " +
  "focus:border-neutral-900 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100";

export function LoginForm() {
  const t = useTranslations("login");
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, { email: "" });

  return (
    <form action={action} className="space-y-4">
      <label className="block text-sm font-medium">
        {t("email")}
        <input name="email" type="email" autoComplete="username" required autoFocus
          defaultValue={state.email} className={input} />
      </label>
      <label className="block text-sm font-medium">
        {t("password")}
        <input name="password" type="password" autoComplete="current-password" required className={input} />
      </label>
      {state.error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          {t(`errors.${state.error}`, { minutes: state.minutes ?? 0 })}
        </p>
      )}
      <button type="submit" disabled={pending}
        className="w-full rounded-md bg-neutral-900 px-3 py-2 font-medium text-white hover:bg-neutral-700 disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900">
        {pending ? t("submitting") : t("submit")}
      </button>
    </form>
  );
}
