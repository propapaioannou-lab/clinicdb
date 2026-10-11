import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

// Groups of actions for the filter. Matched by prefix.
export const ACTION_GROUPS = {
  logins: ["auth.login.success", "auth.login.password_ok"],
  failures: ["auth.login.failure", "auth.login.locked"],
  security: ["auth.2fa.", "auth.recovery_code.", "auth.trusted_device.", "auth.session."],
  patients: ["patient.", "history."],
  users: ["user."],
  audit: ["audit."],
  system: ["backup."],
} as const;
export type ActionGroup = keyof typeof ACTION_GROUPS;

export type AuditFilters = {
  userId?: string; // acted, or was acted on
  group?: ActionGroup;
  from?: Date;
  to?: Date;
  before?: bigint; // paging: entries older than this id
};

export const PAGE_SIZE = 50;

export async function queryAudit(f: AuditFilters) {
  const and: Prisma.AuditLogWhereInput[] = [];
  if (f.userId) and.push({ OR: [{ actorUserId: f.userId }, { entityId: f.userId }] });
  if (f.group) and.push({ OR: ACTION_GROUPS[f.group].map((p) => (p.endsWith(".") ? { action: { startsWith: p } } : { action: p })) });
  if (f.from) and.push({ at: { gte: f.from } });
  if (f.to) and.push({ at: { lte: f.to } });
  if (f.before) and.push({ id: { lt: f.before } });

  const rows = await db.auditLog.findMany({ where: { AND: and }, orderBy: { id: "desc" }, take: PAGE_SIZE + 1 });
  const page = rows.slice(0, PAGE_SIZE);

  // Names for everyone mentioned, including deleted users.
  const ids = new Set<string>();
  for (const r of page) {
    if (r.actorUserId) ids.add(r.actorUserId);
    if (r.entityType === "User" && r.entityId) ids.add(r.entityId);
    const d = r.details as Record<string, unknown> | null;
    if (d && typeof d.userId === "string") ids.add(d.userId);
  }
  const patientIds = page.filter((r) => r.entityType === "Patient" && r.entityId).map((r) => r.entityId!);
  const [users, deleted, patients] = await Promise.all([
    db.user.findMany({ where: { id: { in: [...ids] } }, select: { id: true, name: true, email: true } }),
    db.deletedUser.findMany({ where: { userId: { in: [...ids] } }, select: { userId: true, name: true, email: true } }),
    db.patient.findMany({
      where: { id: { in: patientIds } },
      select: { id: true, number: true, surname: true, firstName: true },
    }),
  ]);
  const people = new Map<string, { name: string; email: string; deleted: boolean }>();
  for (const u of users) people.set(u.id, { name: u.name, email: u.email, deleted: false });
  for (const u of deleted) people.set(u.userId, { name: u.name, email: u.email, deleted: true });

  return {
    entries: page.map((r) => {
      const d = (r.details ?? null) as Record<string, unknown> | null;
      const targetId = r.entityType === "User" ? r.entityId : typeof d?.userId === "string" ? (d.userId as string) : null;
      return {
        id: r.id.toString(),
        at: r.at,
        action: r.action,
        actor: r.actorUserId ? (people.get(r.actorUserId) ?? null) : null,
        actorId: r.actorUserId,
        actorEmail: r.actorEmail,
        target: targetId && targetId !== r.actorUserId ? (people.get(targetId) ?? null) : null,
        targetId: targetId && targetId !== r.actorUserId ? targetId : null,
        patient: r.entityType === "Patient" ? (patients.find((p) => p.id === r.entityId) ?? null) : null,
        details: d,
        ip: r.ip,
        userAgent: r.userAgent,
      };
    }),
    nextBefore: rows.length > PAGE_SIZE ? page[page.length - 1].id.toString() : null,
  };
}

// Everyone who can be chosen in the person filter, deleted users included.
export async function auditPeople() {
  const [users, deleted] = await Promise.all([
    db.user.findMany({ select: { id: true, name: true, email: true }, orderBy: { name: "asc" } }),
    db.deletedUser.findMany({ select: { userId: true, name: true, email: true }, orderBy: { name: "asc" } }),
  ]);
  return [
    ...users.map((u) => ({ id: u.id, label: `${u.name} (${u.email})`, deleted: false })),
    ...deleted.map((u) => ({ id: u.userId, label: `${u.name} (${u.email})`, deleted: true })),
  ];
}
