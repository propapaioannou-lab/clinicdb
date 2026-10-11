import { db } from "@/lib/db";
import { hasExpired } from "@/lib/permissions";

export type UserStatus = "invited" | "inactive" | "expired" | "locked" | "active";

export function userStatus(
  u: { passwordHash: string | null; isActive: boolean; level: "OWNER" | "ADMIN" | "USER" | "GUEST"; accessExpiresAt: Date | null; lockedUntil: Date | null },
  now = new Date(),
): UserStatus {
  if (!u.isActive) return "inactive";
  if (!u.passwordHash) return "invited";
  if (hasExpired(u, now)) return "expired";
  if (u.lockedUntil && u.lockedUntil > now) return "locked";
  return "active";
}

const activeSessionWhere = (now: Date) => ({ revokedAt: null, stage: "ACTIVE" as const, expiresAt: { gt: now } });

export async function listUsers(now = new Date()) {
  const users = await db.user.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: {
      memberships: { include: { company: true } },
      _count: { select: { sessions: { where: activeSessionWhere(now) } } },
    },
  });
  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    level: u.level,
    status: userStatus(u, now),
    twoFactor: u.totpEnabledAt !== null,
    lastLoginAt: u.lastLoginAt,
    accessExpiresAt: u.accessExpiresAt,
    companies: u.memberships.map((m) => m.company.name),
    activeSessions: u._count.sessions,
  }));
}

export async function getUserDetail(id: string, now = new Date()) {
  const u = await db.user.findUnique({
    where: { id },
    include: {
      memberships: true,
      sessions: { where: activeSessionWhere(now), orderBy: { lastSeenAt: "desc" } },
      trustedDevices: { where: { revokedAt: null, expiresAt: { gt: now } }, orderBy: { createdAt: "desc" } },
      invitations: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!u) return null;
  const inv = u.invitations[0];
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    level: u.level,
    isActive: u.isActive,
    accessExpiresAt: u.accessExpiresAt,
    status: userStatus(u, now),
    twoFactor: u.totpEnabledAt !== null,
    lastLoginAt: u.lastLoginAt,
    lockedUntil: u.lockedUntil,
    createdAt: u.createdAt,
    companyIds: u.memberships.map((m) => m.companyId),
    invitation: inv && !u.passwordHash ? { expiresAt: inv.expiresAt, expired: inv.expiresAt <= now || !!inv.revokedAt } : null,
    sessions: u.sessions.map((s) => ({
      id: s.id, createdAt: s.createdAt, lastSeenAt: s.lastSeenAt, expiresAt: s.expiresAt, ip: s.ip, userAgent: s.userAgent, viaTrustedDevice: !!s.trustedDeviceId,
    })),
    trustedDevices: u.trustedDevices.map((d) => ({
      id: d.id, createdAt: d.createdAt, lastUsedAt: d.lastUsedAt, expiresAt: d.expiresAt, ip: d.ip, userAgent: d.userAgent,
    })),
  };
}

// Everyone logged in right now, newest activity first (devices overview).
export async function listActiveSessions(now = new Date()) {
  return db.session.findMany({
    where: activeSessionWhere(now),
    orderBy: { lastSeenAt: "desc" },
    include: { user: { select: { id: true, name: true, email: true, level: true } } },
  });
}

export async function listCompanies() {
  return db.company.findMany({ orderBy: { createdAt: "asc" } });
}
