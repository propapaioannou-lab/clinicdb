import { db } from "@/lib/db";
import { audit, type RequestContext } from "@/lib/audit";
import { hasExpired } from "@/lib/permissions";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSession } from "./sessions";

export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;

export type LoginResult =
  | { ok: true; user: { id: string; email: string } }
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

  if (!user) {
    dummyHash ??= hashPassword("not-a-real-password");
    await verifyPassword(password, await dummyHash);
    await audit({ action: "auth.login.failure", actorEmail: email, details: { reason: "unknown_email" } }, ctx);
    return { ok: false, reason: "invalid" };
  }
  const actor = { id: user.id, email: user.email };

  if (user.lockedUntil && user.lockedUntil > now) {
    await audit({ action: "auth.login.failure", actor, details: { reason: "locked" } }, ctx);
    return { ok: false, reason: "locked", lockedUntil: user.lockedUntil };
  }

  if (!(await verifyPassword(password, user.passwordHash))) {
    const { failedLogins } = await db.user.update({
      where: { id: user.id },
      data: { failedLogins: { increment: 1 } },
    });
    if (failedLogins >= MAX_FAILED_LOGINS) {
      const lockedUntil = new Date(now.getTime() + LOCK_MINUTES * 60 * 1000);
      await db.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil } });
      await audit({ action: "auth.login.locked", actor, details: { lockedUntil: lockedUntil.toISOString() } }, ctx);
      return { ok: false, reason: "locked", lockedUntil };
    }
    await audit({ action: "auth.login.failure", actor, details: { reason: "wrong_password", failedLogins } }, ctx);
    return { ok: false, reason: "invalid" };
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
  return { ok: true, user: actor };
}

// Password check + new session. (Step 4 adds the 2FA code between the two.)
export async function login(email: string, password: string, ctx: RequestContext, now = new Date()) {
  const result = await checkPassword(email, password, ctx, now);
  if (!result.ok) return result;
  const { token, session } = await createSession(result.user.id, ctx, now);
  await audit(
    { action: "auth.login.success", actor: result.user, entityType: "Session", entityId: session.id },
    ctx,
  );
  return { ok: true as const, token, expiresAt: session.expiresAt };
}
