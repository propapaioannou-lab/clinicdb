import { randomInt } from "node:crypto";
import { db } from "@/lib/db";
import { audit, type RequestContext } from "@/lib/audit";
import { decrypt, encrypt, fingerprint } from "@/lib/secrets";
import { generateTotpSecret, otpauthUrl, verifyTotp } from "@/lib/totp";
import { recordFailedAttempt } from "./login";
import { activateSession, hashToken, newToken } from "./sessions";

export const TOTP_ISSUER = "ClinicDB";
export const TRUST_DAYS = 90;
export const RECOVERY_CODE_COUNT = 10;
const TOTP_PURPOSE = "totp-secret";
const RECOVERY_PURPOSE = "recovery-code";

// --- trusted devices ---------------------------------------------------------

export async function findTrustedDevice(userId: string, token: string | undefined, now = new Date()) {
  if (!token) return null;
  const device = await db.trustedDevice.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!device || device.userId !== userId || device.revokedAt || device.expiresAt <= now) return null;
  return device;
}

async function trustDevice(actor: { id: string; email: string }, ctx: RequestContext, now: Date) {
  const token = newToken();
  const device = await db.trustedDevice.create({
    data: {
      userId: actor.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(now.getTime() + TRUST_DAYS * 24 * 60 * 60 * 1000),
      lastUsedAt: now,
      ip: ctx.ip,
      userAgent: ctx.userAgent?.slice(0, 500) ?? null,
    },
  });
  await audit({ action: "auth.trusted_device.created", actor, entityType: "TrustedDevice", entityId: device.id }, ctx);
  return { token, device };
}

// --- recovery codes ----------------------------------------------------------

const RECOVERY_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

function normalizeRecoveryCode(code: string) {
  return code.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// 10 codes like "k7m2p-x9qrt" (~49 bits each). Replaces any earlier set.
export async function createRecoveryCodes(userId: string): Promise<string[]> {
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () => {
    let c = "";
    for (let i = 0; i < 10; i++) c += RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)];
    return `${c.slice(0, 5)}-${c.slice(5)}`;
  });
  await db.$transaction([
    db.recoveryCode.deleteMany({ where: { userId } }),
    db.recoveryCode.createMany({
      data: codes.map((c) => ({ userId, codeHash: fingerprint(normalizeRecoveryCode(c), RECOVERY_PURPOSE) })),
    }),
  ]);
  return codes;
}

async function redeemRecoveryCode(userId: string, code: string, now: Date) {
  const codeHash = fingerprint(normalizeRecoveryCode(code), RECOVERY_PURPOSE);
  // Atomic: a code can only be marked used once.
  const { count } = await db.recoveryCode.updateMany({ where: { userId, codeHash, usedAt: null }, data: { usedAt: now } });
  if (count === 0) return null;
  return db.recoveryCode.count({ where: { userId, usedAt: null } });
}

// --- enrollment (first login) ------------------------------------------------

// Returns the secret to show as QR code. Re-uses an unconfirmed secret so the QR
// code stays the same if the page is reloaded.
export async function startEnrollment(userId: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.totpEnabledAt) throw new Error("2FA already set up");
  let secret: string;
  if (user.totpSecretEnc) {
    secret = decrypt(user.totpSecretEnc, TOTP_PURPOSE);
  } else {
    secret = generateTotpSecret();
    await db.user.update({ where: { id: userId }, data: { totpSecretEnc: encrypt(secret, TOTP_PURPOSE) } });
  }
  return { secret, url: otpauthUrl(secret, user.email, TOTP_ISSUER) };
}

export type SecondFactorResult =
  | { ok: true; recoveryCodes?: string[]; recoveryCodesLeft?: number; trustedToken?: string; trustedUntil?: Date }
  | { ok: false; reason: "invalid" | "locked" | "expired"; lockedUntil?: Date };

type Pending = { sessionId: string; user: { id: string; email: string } };

async function finish(pending: Pending, trust: boolean, ctx: RequestContext, now: Date, method: string) {
  const actor = pending.user;
  let trusted: { token: string; device: { id: string; expiresAt: Date } } | undefined;
  if (trust) trusted = await trustDevice(actor, ctx, now);
  await activateSession(pending.sessionId, now);
  await db.user.update({ where: { id: actor.id }, data: { failedLogins: 0, lockedUntil: null } });
  await audit({ action: "auth.login.success", actor, entityType: "Session", entityId: pending.sessionId, details: { method } }, ctx);
  return trusted ? { trustedToken: trusted.token, trustedUntil: trusted.device.expiresAt } : {};
}

async function isLocked(userId: string, now: Date) {
  const u = await db.user.findUniqueOrThrow({ where: { id: userId } });
  return u.lockedUntil && u.lockedUntil > now ? u.lockedUntil : null;
}

export async function confirmEnrollment(
  pending: Pending,
  code: string,
  trust: boolean,
  ctx: RequestContext,
  now = new Date(),
): Promise<SecondFactorResult> {
  const lockedUntil = await isLocked(pending.user.id, now);
  if (lockedUntil) return { ok: false, reason: "locked", lockedUntil };
  const user = await db.user.findUniqueOrThrow({ where: { id: pending.user.id } });
  if (!user.totpSecretEnc || user.totpEnabledAt) return { ok: false, reason: "expired" };

  const step = verifyTotp(decrypt(user.totpSecretEnc, TOTP_PURPOSE), code, now, null);
  if (step === null) return recordFailedAttempt(pending.user, "wrong_2fa_setup_code", ctx, now);

  await db.user.update({ where: { id: user.id }, data: { totpEnabledAt: now, totpLastStep: step } });
  const recoveryCodes = await createRecoveryCodes(user.id);
  await audit({ action: "auth.2fa.enrolled", actor: pending.user, entityType: "User", entityId: user.id }, ctx);
  const done = await finish(pending, trust, ctx, now, "2fa_setup");
  await db.session.update({
    where: { id: pending.sessionId },
    data: { recoveryCodesEnc: encrypt(JSON.stringify(recoveryCodes), RECOVERY_PURPOSE) },
  });
  return { ok: true, recoveryCodes, ...done };
}

// --- every later login -----------------------------------------------------------

export async function verifySecondFactor(
  pending: Pending,
  code: string,
  trust: boolean,
  ctx: RequestContext,
  now = new Date(),
): Promise<SecondFactorResult> {
  const lockedUntil = await isLocked(pending.user.id, now);
  if (lockedUntil) return { ok: false, reason: "locked", lockedUntil };
  const user = await db.user.findUniqueOrThrow({ where: { id: pending.user.id } });
  if (!user.totpSecretEnc || !user.totpEnabledAt) return { ok: false, reason: "expired" };

  const clean = code.replace(/\s/g, "");
  if (/^\d{6}$/.test(clean)) {
    const step = verifyTotp(decrypt(user.totpSecretEnc, TOTP_PURPOSE), clean, now, user.totpLastStep);
    if (step === null) return recordFailedAttempt(pending.user, "wrong_2fa_code", ctx, now);
    // Only move forward: guards against two requests racing with the same code.
    const { count } = await db.user.updateMany({
      where: { id: user.id, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] },
      data: { totpLastStep: step },
    });
    if (count === 0) return recordFailedAttempt(pending.user, "reused_2fa_code", ctx, now);
    return { ok: true, ...(await finish(pending, trust, ctx, now, "totp")) };
  }

  const left = await redeemRecoveryCode(user.id, clean, now);
  if (left === null) return recordFailedAttempt(pending.user, "wrong_recovery_code", ctx, now);
  await audit({ action: "auth.recovery_code.used", actor: pending.user, details: { codesLeft: left } }, ctx);
  return { ok: true, recoveryCodesLeft: left, ...(await finish(pending, trust, ctx, now, "recovery_code")) };
}

// Returns the new recovery codes once, then deletes them from the session for good.
export async function takeRecoveryCodesForDisplay(sessionId: string): Promise<string[] | null> {
  const s = await db.session.findUnique({ where: { id: sessionId }, select: { recoveryCodesEnc: true } });
  if (!s?.recoveryCodesEnc) return null;
  const { count } = await db.session.updateMany({
    where: { id: sessionId, recoveryCodesEnc: s.recoveryCodesEnc },
    data: { recoveryCodesEnc: null },
  });
  if (count === 0) return null;
  return JSON.parse(decrypt(s.recoveryCodesEnc, RECOVERY_PURPOSE)) as string[];
}
