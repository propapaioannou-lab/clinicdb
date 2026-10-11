import { login } from "@/lib/auth/login";
import { validatePendingSession } from "@/lib/auth/sessions";
import { verifySecondFactor } from "@/lib/auth/two-factor";
import { ctx, totpCode } from "./factories";

// Password + current 2FA code, as a person would do it. Returns the session token.
export async function fullLogin(email: string, password: string, totpSecret: string, now = new Date()) {
  const r = await login(email, password, ctx, now);
  if (!r.ok) throw new Error(`password step failed: ${r.reason}`);
  const pending = await validatePendingSession(r.token, now);
  if (!pending) throw new Error("no pending session");
  const v = await verifySecondFactor(pending, totpCode(totpSecret, now), false, ctx, now);
  if (!v.ok) throw new Error(`2FA step failed: ${v.reason}`);
  return r.token;
}
