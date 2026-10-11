import { db } from "@/lib/db";
import { audit, type RequestContext } from "@/lib/audit";
import { hasExpired } from "@/lib/permissions";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSession } from "./sessions";
import { findTrustedDevice } from "./two-factor";

export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;

export type LoginResult =
  | { ok: true; user: { id: string; email: string; totpEnabled: boolean } }
  | { ok: false; reason: "invalid" | "locked" | "inactive" | "expired"; lockedUntil?: Date };

// Compared against when the email is unknown, so the response takes the same time
// and does not reveal which emails have accounts.
let dummyHash: Promise<string> | undefined;

export async function checkPassword(
  emailInput: string,
  password: string,
  ctx: RequestContext,
  now = new Date(),
): Promise<LoginResult> {
  const email = emailInput.trim().toLowerCase();
  const user = await db.user.findUnique({ where: { email } });

  if (!user || !user.passwordHash) {
    dummyHash ??= hashPassword("not-a-real-password");
    await verifyPassword(password, await dummyHash);
    await audit(
      user
        ? { action: "auth.login.failure", actor: { id: user.id, email: user.email }, details: { reason: "invitation_not_accepted" } }
        : { action: "auth.login.failure", actorEmail: email, details: { reason: "unknown_email" } },
      ctx,
    );
    return { ok: false, reason: "invalid" };
  }
  const actor = { id: user.id, email: user.email };

  if (user.lockedUntil && user.lockedUntil > now) {
    await audit({ action: "auth.login.failure", actor, details: { reason: "locked" } }, ctx);
    return { ok: false, reason: "locked", lockedUntil: user.lockedUntil };
  }

  if (!(await verifyPassword(password, user.passwordHash))) {
    return recordFailedAttempt(actor, "wrong_password", ctx, now);
  }

  if (!user.isActive) {
    await audit({ action: "auth.login.failure", actor, details: { reason: "inactive" } }, ctx);
    return { ok: false, reason: "inactive" };
  }
  if (hasExpired(user, now)) {
    await audit({ action: "auth.login.failure", actor, details: { reason: "guest_expired" } }, ctx);
    return { ok: false, reason: "expired" };
  }

  await db.user.update({
    where: { id: user.id },
    data: { failedLogins: 0, lockedUntil: null, lastLoginAt: now },
  });
  return { ok: true, user: { ...actor, totpEnabled: user.totpEnabledAt !== null } };
}

// Wrong password or wrong 2FA code: both count toward the same lockout.
export async function recordFailedAttempt(
  actor: { id: string; email: string },
  reason: string,
  ctx: RequestContext,
  now = new Date(),
): Promise<{ ok: false; reason: "invalid" | "locked"; lockedUntil?: Date }> {
  const { failedLogins } = await db.user.update({
    where: { id: actor.id },
    data: { failedLogins: { increment: 1 } },
  });
  if (failedLogins >= MAX_FAILED_LOGINS) {
    const lockedUntil = new Date(now.getTime() + LOCK_MINUTES * 60 * 1000);
    await db.user.update({ where: { id: actor.id }, data: { failedLogins: 0, lockedUntil } });
    // Half-finished logins of a locked account are ended too.
    await db.session.updateMany({
      where: { userId: actor.id, stage: { not: "ACTIVE" }, revokedAt: null },
      data: { revokedAt: now, revokeReason: "locked" },
    });
    await audit({ action: "auth.login.locked", actor, details: { reason, lockedUntil: lockedUntil.toISOString() } }, ctx);
    return { ok: false, reason: "locked", lockedUntil };
  }
  await audit({ action: "auth.login.failure", actor, details: { reason, failedLogins } }, ctx);
  return { ok: false, reason: "invalid" };
}

export type LoginOutcome =
  | (LoginResult & { ok: false })
  | { ok: true; token: string; expiresAt: Date; next: "/" | "/login/2fa" | "/login/setup-2fa" };

// Password check, then: trusted device -> straight in; otherwise a short pending
// session that can only reach the 2FA page (or 2FA setup the first time).
export async function login(
  email: string,
  password: string,
  ctx: RequestContext,
  now = new Date(),
  trustedToken?: string,
): Promise<LoginOutcome> {
  const result = await checkPassword(email, password, ctx, now);
  if (!result.ok) return result;
  const { user } = result;
  const actor = { id: user.id, email: user.email };

  if (user.totpEnabled) {
    const device = await findTrustedDevice(user.id, trustedToken, now);
    if (device) {
      const { token, session } = await createSession(user.id, ctx, now, { trustedDeviceId: device.id });
      await db.trustedDevice.update({ where: { id: device.id }, data: { lastUsedAt: now } });
      await audit(
        { action: "auth.login.success", actor, entityType: "Session", entityId: session.id, details: { method: "trusted_device" } },
        ctx,
      );
      return { ok: true, token, expiresAt: session.expiresAt, next: "/" };
    }
  }

  const stage = user.totpEnabled ? "PENDING_2FA" : "PENDING_ENROLL";
  const { token, session } = await createSession(user.id, ctx, now, { stage });
  await audit({ action: "auth.login.password_ok", actor, entityType: "Session", entityId: session.id, details: { stage } }, ctx);
  return { ok: true, token, expiresAt: session.expiresAt, next: user.totpEnabled ? "/login/2fa" : "/login/setup-2fa" };
}
