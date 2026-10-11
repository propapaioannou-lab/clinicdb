import { db } from "@/lib/db";
import { audit, type RequestContext } from "@/lib/audit";
import type { Level, Prisma, Role } from "@/generated/prisma/client";
import { generatePassword, hashPassword } from "@/lib/password";
import {
  canAssignLevel,
  canChangeLevel,
  canManageUser,
  canManageUsers,
  canRemoveUser,
  resolveCompanyAccess,
} from "@/lib/permissions";
import { resetTwoFactor } from "@/lib/auth/reset-two-factor";
import { revokeSession } from "@/lib/auth/sessions";
import { createInvitation, sendInvitationEmail } from "./invitations";

// Every user-management action goes through here: permissions are checked on the
// server for every call, and every change is written to the audit log.

export type Actor = { id: string; email: string; name: string; level: Level; companyIds: string[] };

export type ManageError =
  | "forbidden"
  | "not_found"
  | "self"
  | "invalid_email"
  | "name_required"
  | "email_taken"
  | "no_company"
  | "guest_needs_end_date"
  | "not_invited";

type Fail = { ok: false; error: ManageError };
const fail = (error: ManageError): Fail => ({ ok: false, error });

// Fresh from the database on every action, so a just-changed level applies at once.
export async function loadActor(userId: string): Promise<Actor> {
  const u = await db.user.findUniqueOrThrow({ where: { id: userId }, include: { memberships: true } });
  return { id: u.id, email: u.email, name: u.name, level: u.level, companyIds: u.memberships.map((m) => m.companyId) };
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type UserInput = {
  name: string;
  level: Level;
  role: Role;
  companyIds: string[];
  accessExpiresAt: Date | null; // Guests only
};

function validate(input: UserInput, now: Date): ManageError | null {
  if (!input.name.trim()) return "name_required";
  if (input.level === "GUEST" && (!input.accessExpiresAt || input.accessExpiresAt <= now)) return "guest_needs_end_date";
  return null;
}

async function setCompanies(userId: string, companyIds: string[]) {
  await db.$transaction([
    db.membership.deleteMany({ where: { userId, companyId: { notIn: companyIds } } }),
    ...companyIds.map((companyId) =>
      db.membership.upsert({
        where: { userId_companyId: { userId, companyId } },
        update: {},
        create: { userId, companyId },
      }),
    ),
  ]);
}

async function revokeAllSessions(userId: string, by: Actor, reason: string, now = new Date()) {
  await db.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: now, revokedById: by.id, revokeReason: reason },
  });
}

// --- create --------------------------------------------------------------------

export async function createUser(
  actor: Actor,
  input: UserInput & { email: string; method: "invite" | "password" },
  ctx: RequestContext,
  now = new Date(),
): Promise<Fail | { ok: true; userId: string; password?: string; mailFailed?: boolean }> {
  if (!canManageUsers(actor.level)) return fail("forbidden");
  if (!canAssignLevel(actor.level, input.level)) return fail("forbidden");
  const email = input.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return fail("invalid_email");
  const invalid = validate(input, now);
  if (invalid) return fail(invalid);
  const companyIds = resolveCompanyAccess(actor, [], input.companyIds);
  if (companyIds.length === 0) return fail("no_company");
  if (await db.user.findUnique({ where: { email } })) return fail("email_taken");

  const password = input.method === "password" ? generatePassword() : undefined;
  const user = await db.user.create({
    data: {
      email,
      name: input.name.trim(),
      level: input.level,
      role: input.role,
      accessExpiresAt: input.level === "GUEST" ? input.accessExpiresAt : null,
      passwordHash: password ? await hashPassword(password) : null,
      memberships: { create: companyIds.map((companyId) => ({ companyId })) },
    },
  });
  await audit(
    {
      action: "user.created",
      actor,
      entityType: "User",
      entityId: user.id,
      details: { email, level: user.level, role: user.role, companyIds, method: input.method, accessExpiresAt: user.accessExpiresAt?.toISOString() ?? null },
    },
    ctx,
  );

  if (password) return { ok: true, userId: user.id, password };
  const mailFailed = !(await inviteAndSend(actor, user, ctx, now));
  return { ok: true, userId: user.id, mailFailed };
}

async function inviteAndSend(actor: Actor, user: { id: string; name: string; email: string }, ctx: RequestContext, now: Date) {
  const token = await createInvitation(user.id, actor.id, now);
  try {
    await sendInvitationEmail(user, token, actor.name);
    await audit({ action: "user.invitation.sent", actor, entityType: "User", entityId: user.id }, ctx);
    return true;
  } catch (e) {
    await audit(
      { action: "user.invitation.mail_failed", actor, entityType: "User", entityId: user.id, details: { error: String(e).slice(0, 300) } },
      ctx,
    );
    return false;
  }
}

// --- edit ----------------------------------------------------------------------

export async function updateUser(
  actor: Actor,
  userId: string,
  input: UserInput,
  ctx: RequestContext,
  now = new Date(),
): Promise<Fail | { ok: true }> {
  const target = await db.user.findUnique({ where: { id: userId }, include: { memberships: true } });
  if (!target) return fail("not_found");
  if (!canManageUser(actor.level, target.level)) return fail("forbidden");
  const isSelf = actor.id === target.id;
  if (input.level !== target.level) {
    if (isSelf) return fail("self");
    if (!canChangeLevel(actor.level, target.level, input.level)) return fail("forbidden");
  }
  const invalid = validate(input, now);
  if (invalid) return fail(invalid);
  const before = target.memberships.map((m) => m.companyId);
  const companyIds = resolveCompanyAccess(actor, before, input.companyIds);
  if (companyIds.length === 0) return fail("no_company");

  const accessExpiresAt = input.level === "GUEST" ? input.accessExpiresAt : null;
  await db.user.update({
    where: { id: userId },
    data: { name: input.name.trim(), level: input.level, role: input.role, accessExpiresAt },
  });
  await setCompanies(userId, companyIds);

  type Json = Prisma.InputJsonValue | null;
  const changes: Record<string, { from: Json; to: Json }> = {};
  const cmp = (k: string, from: Json, to: Json) => {
    if (JSON.stringify(from) !== JSON.stringify(to)) changes[k] = { from, to };
  };
  cmp("name", target.name, input.name.trim());
  cmp("level", target.level, input.level);
  cmp("role", target.role, input.role);
  cmp("accessExpiresAt", target.accessExpiresAt?.toISOString() ?? null, accessExpiresAt?.toISOString() ?? null);
  cmp("companyIds", [...before].sort(), [...companyIds].sort());
  if (Object.keys(changes).length > 0) {
    await audit({ action: "user.updated", actor, entityType: "User", entityId: userId, details: changes }, ctx);
  }
  return { ok: true };
}

// --- one-click actions -------------------------------------------------------------

async function loadManageable(actor: Actor, userId: string) {
  const target = await db.user.findUnique({ where: { id: userId } });
  if (!target) return fail("not_found");
  if (!canManageUser(actor.level, target.level)) return fail("forbidden");
  return { ok: true as const, target };
}

// New permanent password, shown once to the admin. Ends the user's open logins.
export async function generatePasswordFor(actor: Actor, userId: string, ctx: RequestContext) {
  const r = await loadManageable(actor, userId);
  if (!r.ok) return r;
  const password = generatePassword();
  await db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(password), failedLogins: 0, lockedUntil: null } });
  await db.invitation.updateMany({ where: { userId, usedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
  if (actor.id !== userId) await revokeAllSessions(userId, actor, "password_changed");
  await audit({ action: "user.password.generated", actor, entityType: "User", entityId: userId }, ctx);
  return { ok: true as const, password };
}

export async function resendInvitation(actor: Actor, userId: string, ctx: RequestContext) {
  const r = await loadManageable(actor, userId);
  if (!r.ok) return r;
  if (r.target.passwordHash) return fail("not_invited");
  const sent = await inviteAndSend(actor, r.target, ctx, new Date());
  return { ok: true as const, mailFailed: !sent };
}

export async function resetTwoFactorFor(actor: Actor, userId: string, ctx: RequestContext) {
  const r = await loadManageable(actor, userId);
  if (!r.ok) return r;
  await resetTwoFactor(userId, actor, ctx);
  return { ok: true as const };
}

export async function unlockUser(actor: Actor, userId: string, ctx: RequestContext) {
  const r = await loadManageable(actor, userId);
  if (!r.ok) return r;
  await db.user.update({ where: { id: userId }, data: { lockedUntil: null, failedLogins: 0 } });
  await audit({ action: "user.unlocked", actor, entityType: "User", entityId: userId }, ctx);
  return { ok: true as const };
}

// Suspend: cannot log in, logged out everywhere; everything kept for reactivation.
export async function suspendUser(actor: Actor, userId: string, ctx: RequestContext) {
  const target = await db.user.findUnique({ where: { id: userId } });
  if (!target) return fail("not_found");
  if (actor.id === userId) return fail("self");
  if (!canRemoveUser(actor.level, target.level)) return fail("forbidden");
  await db.user.update({ where: { id: userId }, data: { isActive: false } });
  await revokeAllSessions(userId, actor, "suspended");
  await audit({ action: "user.suspended", actor, entityType: "User", entityId: userId }, ctx);
  return { ok: true as const };
}

export async function reactivateUser(actor: Actor, userId: string, ctx: RequestContext) {
  const r = await loadManageable(actor, userId);
  if (!r.ok) return r;
  await db.user.update({ where: { id: userId }, data: { isActive: true } });
  await audit({ action: "user.reactivated", actor, entityType: "User", entityId: userId }, ctx);
  return { ok: true as const };
}

// Permanent. A DeletedUser record keeps who it was, so the audit history stays readable.
export async function deleteUser(actor: Actor, userId: string, ctx: RequestContext) {
  const target = await db.user.findUnique({ where: { id: userId }, include: { memberships: { include: { company: true } } } });
  if (!target) return fail("not_found");
  if (actor.id === userId) return fail("self");
  if (!canRemoveUser(actor.level, target.level)) return fail("forbidden");
  const companies = target.memberships.map((m) => m.company.name);
  await db.$transaction([
    db.deletedUser.create({
      data: {
        userId: target.id,
        email: target.email,
        name: target.name,
        level: target.level,
        companies,
        createdAt: target.createdAt,
        deletedById: actor.id,
        deletedByEmail: actor.email,
      },
    }),
    db.user.delete({ where: { id: userId } }),
  ]);
  await audit(
    { action: "user.deleted", actor, entityType: "User", entityId: userId, details: { email: target.email, name: target.name, level: target.level, companies } },
    ctx,
  );
  return { ok: true as const };
}

// --- devices -------------------------------------------------------------------------

export async function endSession(actor: Actor, sessionId: string, ctx: RequestContext) {
  const s = await db.session.findUnique({ where: { id: sessionId }, include: { user: true } });
  if (!s) return fail("not_found");
  if (s.userId !== actor.id && !canManageUser(actor.level, s.user.level)) return fail("forbidden");
  if (!s.revokedAt) await revokeSession(s.id, actor, s.userId === actor.id ? "self" : "admin", ctx);
  return { ok: true as const };
}

export async function endAllSessions(actor: Actor, userId: string, ctx: RequestContext) {
  const r = await loadManageable(actor, userId);
  if (!r.ok) return r;
  await revokeAllSessions(userId, actor, "admin");
  await audit({ action: "auth.session.revoked_all", actor, entityType: "User", entityId: userId }, ctx);
  return { ok: true as const };
}

export async function removeTrustedDevice(actor: Actor, deviceId: string, ctx: RequestContext) {
  const d = await db.trustedDevice.findUnique({ where: { id: deviceId }, include: { user: true } });
  if (!d) return fail("not_found");
  if (d.userId !== actor.id && !canManageUser(actor.level, d.user.level)) return fail("forbidden");
  if (!d.revokedAt) {
    await db.trustedDevice.update({ where: { id: deviceId }, data: { revokedAt: new Date(), revokedById: actor.id } });
    await audit(
      { action: "auth.trusted_device.revoked", actor, entityType: "TrustedDevice", entityId: deviceId, details: { userId: d.userId } },
      ctx,
    );
  }
  return { ok: true as const };
}
