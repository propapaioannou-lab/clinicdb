import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { audit, type RequestContext } from "@/lib/audit";
import { hasExpired } from "@/lib/permissions";
import type { SessionStage } from "@/generated/prisma/client";
import { nextWeeklyExpiry } from "./weekly-expiry";

// Only refresh "last activity" this often, to avoid a database write on every click.
const LAST_SEEN_RESOLUTION_MS = 5 * 60 * 1000;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export const PENDING_MINUTES = 10;

export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function createSession(
  userId: string,
  ctx: RequestContext,
  now = new Date(),
  opts: { stage?: SessionStage; trustedDeviceId?: string } = {},
) {
  const token = newToken();
  const stage = opts.stage ?? "ACTIVE";
  const session = await db.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      stage,
      trustedDeviceId: opts.trustedDeviceId ?? null,
      createdAt: now,
      lastSeenAt: now,
      expiresAt:
        stage === "ACTIVE" ? nextWeeklyExpiry(now) : new Date(now.getTime() + PENDING_MINUTES * 60 * 1000),
      ip: ctx.ip,
      userAgent: ctx.userAgent?.slice(0, 500) ?? null,
    },
  });
  return { token, session };
}

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  level: "OWNER" | "ADMIN" | "USER" | "GUEST";
  role: "SURGEON" | "PA_NURSE" | "SECRETARY" | "SPA_STAFF" | "OTHER";
};

// Returns the session and user if the token is still valid, otherwise null.
export async function validateSession(token: string | undefined, now = new Date()) {
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: {
        select: { id: true, email: true, name: true, level: true, role: true, isActive: true, accessExpiresAt: true },
      },
    },
  });
  if (!session || session.stage !== "ACTIVE" || session.revokedAt || session.expiresAt <= now) return null;
  const { user } = session;
  if (!user.isActive || hasExpired(user, now)) return null;

  if (now.getTime() - session.lastSeenAt.getTime() > LAST_SEEN_RESOLUTION_MS) {
    await db.session.update({ where: { id: session.id }, data: { lastSeenAt: now } });
  }
  const sessionUser: SessionUser = { id: user.id, email: user.email, name: user.name, level: user.level, role: user.role };
  return { sessionId: session.id, expiresAt: session.expiresAt, user: sessionUser };
}

export async function revokeSession(
  sessionId: string,
  by: { id: string; email: string },
  reason: string,
  ctx: RequestContext,
) {
  const s = await db.session.update({
    where: { id: sessionId },
    data: { revokedAt: new Date(), revokedById: by.id, revokeReason: reason },
  });
  await audit(
    { action: "auth.session.revoked", actor: by, entityType: "Session", entityId: s.id, details: { reason, userId: s.userId } },
    ctx,
  );
}

// A half-finished login (password right, 2FA pending). Only the 2FA pages accept it.
export async function validatePendingSession(token: string | undefined, now = new Date()) {
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, email: true, name: true, isActive: true } } },
  });
  if (!session || session.stage === "ACTIVE" || session.revokedAt || session.expiresAt <= now) return null;
  if (!session.user.isActive) return null;
  return { sessionId: session.id, stage: session.stage, user: { id: session.user.id, email: session.user.email, name: session.user.name } };
}

// 2FA done: the pending session becomes a normal one, ending next Monday 05:00.
export async function activateSession(sessionId: string, now = new Date(), trustedDeviceId?: string) {
  return db.session.update({
    where: { id: sessionId },
    data: { stage: "ACTIVE", expiresAt: nextWeeklyExpiry(now), lastSeenAt: now, trustedDeviceId: trustedDeviceId ?? null },
  });
}
