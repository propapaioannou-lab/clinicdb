import { db } from "@/lib/db";
import { audit, type RequestContext } from "@/lib/audit";

// Lost phone and recovery codes: remove 2FA, trusted devices and sessions.
// The user sets up 2FA again at the next login (password still required).
export async function resetTwoFactor(userId: string, by: { id?: string; email: string }, ctx: RequestContext) {
  by = { id: by.id, email: by.email };
  const now = new Date();
  const user = await db.user.update({
    where: { id: userId },
    data: { totpSecretEnc: null, totpEnabledAt: null, totpLastStep: null },
  });
  await db.recoveryCode.deleteMany({ where: { userId } });
  await db.trustedDevice.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now, revokedById: by.id ?? null } });
  await db.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: now, revokedById: by.id ?? null, revokeReason: "2fa_reset" },
  });
  await audit(
    { action: "auth.2fa.reset", actor: by.id ? { id: by.id, email: by.email } : null, actorEmail: by.email, entityType: "User", entityId: user.id, details: { userEmail: user.email } },
    ctx,
  );
}
