import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { base32Decode, currentStep, hotp } from "@/lib/totp";
import { ctx, makeUser, totpCode } from "../../../test/factories";
import { fullLogin } from "../../../test/login-helpers";
import { login, MAX_FAILED_LOGINS } from "./login";
import { resetTwoFactor } from "./reset-two-factor";
import { validatePendingSession, validateSession } from "./sessions";
import {
  confirmEnrollment,
  RECOVERY_CODE_COUNT,
  startEnrollment,
  takeRecoveryCodesForDisplay,
  verifySecondFactor,
} from "./two-factor";

async function pendingFor(email: string, password: string, now = new Date(), trustedToken?: string) {
  const r = await login(email, password, ctx, now, trustedToken);
  if (!r.ok) throw new Error(r.reason);
  return { r, pending: (await validatePendingSession(r.token, now))! };
}

describe("2FA setup (first login)", () => {
  it("shows a stable secret, confirms with a code, returns 10 recovery codes and activates the session", async () => {
    const { user, password } = await makeUser({ totp: false });
    const { r, pending } = await pendingFor(user.email, password);
    expect(pending.stage).toBe("PENDING_ENROLL");

    const first = await startEnrollment(user.id);
    expect((await startEnrollment(user.id)).secret).toBe(first.secret); // reload shows same QR
    expect(first.url).toContain("otpauth://totp/");
    const stored = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.totpSecretEnc).not.toContain(first.secret); // encrypted at rest

    expect(await confirmEnrollment(pending, "000000", false, ctx)).toMatchObject({ ok: false, reason: "invalid" });
    const ok = await confirmEnrollment(pending, totpCode(first.secret), false, ctx);
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect(ok.recoveryCodes).toHaveLength(RECOVERY_CODE_COUNT);
    expect(new Set(ok.recoveryCodes).size).toBe(RECOVERY_CODE_COUNT);
    expect(await validateSession(r.token)).not.toBeNull();
    // Codes are stored only as fingerprints.
    expect(await db.recoveryCode.count({ where: { codeHash: { in: ok.recoveryCodes! } } })).toBe(0);
    // The codes page shows them exactly once.
    const v = await validateSession(r.token);
    expect(await takeRecoveryCodesForDisplay(v!.sessionId)).toEqual(ok.recoveryCodes);
    expect(await takeRecoveryCodesForDisplay(v!.sessionId)).toBeNull();
  });
});

describe("2FA at login", () => {
  it("accepts the current code once, never twice", async () => {
    const { user, password, totpSecret } = await makeUser();
    const now = new Date();
    const code = totpCode(totpSecret!, now);
    const a = await pendingFor(user.email, password, now);
    expect((await verifySecondFactor(a.pending, code, false, ctx, now)).ok).toBe(true);
    expect(await validateSession(a.r.token, now)).not.toBeNull();

    const b = await pendingFor(user.email, password, now);
    expect(await verifySecondFactor(b.pending, code, false, ctx, now)).toMatchObject({ ok: false, reason: "invalid" });
  });

  it("allows ±30 s clock drift but not 2 minutes", async () => {
    const { user, password, totpSecret } = await makeUser();
    const now = new Date();
    const a = await pendingFor(user.email, password, now);
    expect((await verifySecondFactor(a.pending, totpCode(totpSecret!, now, -1), false, ctx, now)).ok).toBe(true);
    const b = await pendingFor(user.email, password, now);
    expect((await verifySecondFactor(b.pending, totpCode(totpSecret!, now, -4), false, ctx, now)).ok).toBe(false);
  });

  it(`locks after ${MAX_FAILED_LOGINS} wrong codes and ends the half-finished login`, async () => {
    const { user, password, totpSecret } = await makeUser();
    const { r, pending } = await pendingFor(user.email, password);
    for (let i = 1; i < MAX_FAILED_LOGINS; i++) {
      expect(await verifySecondFactor(pending, "000000", false, ctx)).toMatchObject({ ok: false, reason: "invalid" });
    }
    expect(await verifySecondFactor(pending, "000000", false, ctx)).toMatchObject({ ok: false, reason: "locked" });
    expect(await validatePendingSession(r.token)).toBeNull();
    // Even the right code is refused while locked.
    expect(await verifySecondFactor(pending, totpCode(totpSecret!), false, ctx)).toMatchObject({ ok: false, reason: "locked" });
  });

  it("a pending session expires after 10 minutes", async () => {
    const { user, password } = await makeUser();
    const now = new Date();
    const { r } = await pendingFor(user.email, password, now);
    expect(await validatePendingSession(r.token, new Date(now.getTime() + 9 * 60 * 1000))).not.toBeNull();
    expect(await validatePendingSession(r.token, new Date(now.getTime() + 11 * 60 * 1000))).toBeNull();
  });
});

describe("recovery codes", () => {
  it("each works once, in any format, and the count left is reported", async () => {
    const { user, password } = await makeUser({ totp: false });
    const { pending } = await pendingFor(user.email, password);
    const { secret } = await startEnrollment(user.id);
    const setup = await confirmEnrollment(pending, totpCode(secret), false, ctx);
    if (!setup.ok) throw new Error("setup failed");
    const [code1] = setup.recoveryCodes!;

    const a = await pendingFor(user.email, password);
    const typedSloppily = ` ${code1.toUpperCase().replace("-", " ")} `;
    expect(await verifySecondFactor(a.pending, typedSloppily, false, ctx)).toMatchObject({
      ok: true,
      recoveryCodesLeft: RECOVERY_CODE_COUNT - 1,
    });
    const b = await pendingFor(user.email, password);
    expect(await verifySecondFactor(b.pending, code1, false, ctx)).toMatchObject({ ok: false, reason: "invalid" });
    expect(await db.auditLog.count({ where: { actorUserId: user.id, action: "auth.recovery_code.used" } })).toBe(1);
  });
});

describe("trusted devices", () => {
  it("skip the code for 90 days, only for the same user", async () => {
    const { user, password, totpSecret } = await makeUser();
    const other = await makeUser();
    const now = new Date();
    const { pending } = await pendingFor(user.email, password, now);
    const v = await verifySecondFactor(pending, totpCode(totpSecret!, now), true, ctx, now);
    if (!v.ok || !v.trustedToken) throw new Error("no trusted token");
    expect(v.trustedUntil!.getTime() - now.getTime()).toBe(90 * 24 * 60 * 60 * 1000);

    const day89 = new Date(now.getTime() + 89 * 24 * 60 * 60 * 1000);
    const again = await login(user.email, password, ctx, day89, v.trustedToken);
    expect(again).toMatchObject({ ok: true, next: "/" });
    if (again.ok) expect(await validateSession(again.token, day89)).not.toBeNull();

    const day91 = new Date(now.getTime() + 91 * 24 * 60 * 60 * 1000);
    expect(await login(user.email, password, ctx, day91, v.trustedToken)).toMatchObject({ next: "/login/2fa" });
    // Another person on the same browser still needs their code.
    expect(await login(other.user.email, other.password, ctx, now, v.trustedToken)).toMatchObject({ next: "/login/2fa" });
    // The password is always required.
    expect(await login(user.email, "wrong-password-1", ctx, now, v.trustedToken)).toMatchObject({ ok: false });
  });
});

describe("emergency 2FA reset", () => {
  it("removes 2FA, trusted devices and sessions; next login sets up 2FA again", async () => {
    const { user, password, totpSecret } = await makeUser();
    const token = await fullLogin(user.email, password, totpSecret!);
    await resetTwoFactor(user.id, { email: "server-script" }, ctx);
    expect(await validateSession(token)).toBeNull();
    expect(await login(user.email, password, ctx)).toMatchObject({ next: "/login/setup-2fa" });
    expect(await db.auditLog.count({ where: { entityId: user.id, action: "auth.2fa.reset" } })).toBe(1);
  });
});

// Sanity check that the helper matches what an app shows.
it("test helper produces app codes", () => {
  const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  const now = new Date(1111111111 * 1000);
  expect(totpCode(secret, now)).toBe(hotp(base32Decode(secret), currentStep(now)));
});
