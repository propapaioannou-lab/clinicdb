"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { generatePassword } from "@/lib/password-generator";
import { ErrorBox, inputClass, primaryButton, secondaryButton } from "../../ui";
import { acceptInviteAction, type InviteState } from "./actions";

export function InviteForm({ token, minLength }: { token: string; minLength: number }) {
  const t = useTranslations("invite");
  const [state, action, pending] = useActionState<InviteState, FormData>(acceptInviteAction.bind(null, token), {});
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [generated, setGenerated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function generate() {
    const p = generatePassword();
    setPassword(p);
    setRepeat(p);
    setGenerated(p);
    setCopied(false);
  }

  return (
    <form action={action} className="space-y-4">
      <button type="button" onClick={generate} className={`${secondaryButton} w-full`}>{t("generate")}</button>
      {generated && (
        <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
          <p>{t("generated")}</p>
          <p className="text-center font-mono text-base tracking-wider">{generated}</p>
          <button type="button" className={secondaryButton}
            onClick={() => navigator.clipboard.writeText(generated).then(() => setCopied(true))}>
            {copied ? t("copied") : t("copy")}
          </button>
        </div>
      )}
      <label className="block text-sm font-medium">
        {t("password", { min: minLength })}
        <input name="password" type="password" autoComplete="new-password" required minLength={minLength}
          value={password} onChange={(e) => { setPassword(e.target.value); setGenerated(null); }} className={inputClass} />
      </label>
      <label className="block text-sm font-medium">
        {t("repeat")}
        <input name="repeat" type="password" autoComplete="new-password" required minLength={minLength}
          value={repeat} onChange={(e) => setRepeat(e.target.value)} className={inputClass} />
      </label>
      {state.error && <ErrorBox>{t(`errors.${state.error}`, { min: minLength })}</ErrorBox>}
      <button type="submit" disabled={pending} className={primaryButton}>
        {pending ? t("submitting") : t("submit")}
      </button>
    </form>
  );
}
