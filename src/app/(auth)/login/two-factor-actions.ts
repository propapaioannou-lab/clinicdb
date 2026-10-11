"use server";

import { redirect } from "next/navigation";
import {
  clearSessionCookie,
  getPendingSession,
  requestContext,
  setTrustedCookie,
} from "@/lib/auth/current";
import { revokeSession } from "@/lib/auth/sessions";
import { confirmEnrollment, verifySecondFactor, type SecondFactorResult } from "@/lib/auth/two-factor";

export type CodeState = {
  error?: "invalid" | "locked" | "expired" | "missing";
  minutes?: number;
};

async function handle(
  formData: FormData,
  run: typeof verifySecondFactor,
): Promise<{ state: CodeState; result?: SecondFactorResult & { ok: true } }> {
  const pending = await getPendingSession();
  if (!pending) return { state: { error: "expired" } };
  const code = String(formData.get("code") ?? "").trim();
  if (!code) return { state: { error: "missing" } };
  const trust = formData.get("trust") === "on";

  const result = await run(pending, code, trust, await requestContext());
  if (!result.ok) {
    if (result.reason === "locked") await clearSessionCookie();
    const minutes = result.lockedUntil ? Math.max(1, Math.ceil((result.lockedUntil.getTime() - Date.now()) / 60000)) : undefined;
    return { state: { error: result.reason, minutes } };
  }
  if (result.trustedToken && result.trustedUntil) await setTrustedCookie(result.trustedToken, result.trustedUntil);
  return { state: {}, result };
}

export async function verifyCodeAction(_prev: CodeState, formData: FormData): Promise<CodeState> {
  const { state, result } = await handle(formData, verifySecondFactor);
  if (!result) return state;
  // After a recovery code, show how many are left.
  if (result.recoveryCodesLeft !== undefined) redirect(`/login/recovery-used?left=${result.recoveryCodesLeft}`);
  redirect("/");
}

export async function confirmSetupAction(_prev: CodeState, formData: FormData): Promise<CodeState> {
  const { state, result } = await handle(formData, confirmEnrollment);
  if (!result) return state;
  redirect("/login/recovery-codes");
}

export async function cancelLoginAction() {
  const pending = await getPendingSession();
  if (pending) await revokeSession(pending.sessionId, pending.user, "login_cancelled", await requestContext());
  await clearSessionCookie();
  redirect("/login");
}
