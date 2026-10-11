"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { ErrorBox, inputClass, primaryButton } from "../../ui";
import { TrustCheckbox } from "../trust-checkbox";
import { confirmSetupAction, type CodeState } from "../two-factor-actions";

export function SetupForm({ qrSvg, secret, trustDays }: { qrSvg: string; secret: string; trustDays: number }) {
  const t = useTranslations("setup2fa");
  const tc = useTranslations("twoFactor");
  const [state, action, pending] = useActionState<CodeState, FormData>(confirmSetupAction, {});

  return (
    <form action={action} className="space-y-4 text-sm">
      <p>1. {t("step1")}</p>
      <p>2. {t("step2")}</p>
      {/* SVG generated on our server from the secret; no external service involved. */}
      <div className="mx-auto w-48 rounded-md bg-white p-2" dangerouslySetInnerHTML={{ __html: qrSvg }} />
      <p className="text-neutral-500">{t("manual")}</p>
      <p className="break-all text-center font-mono tracking-wider">{secret.match(/.{1,4}/g)?.join(" ")}</p>
      <label className="block font-medium">
        3. {t("step3")}
        <input name="code" inputMode="numeric" autoComplete="one-time-code" required maxLength={6}
          pattern="\d{6}" className={`${inputClass} tracking-widest`} />
      </label>
      <TrustCheckbox days={trustDays} />
      {state.error && <ErrorBox>{tc(`errors.${state.error}`, { minutes: state.minutes ?? 0 })}</ErrorBox>}
      <button type="submit" disabled={pending} className={primaryButton}>
        {pending ? t("submitting") : t("submit")}
      </button>
    </form>
  );
}
