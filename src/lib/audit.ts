import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export type RequestContext = { ip: string | null; userAgent: string | null };

export type AuditEntry = {
  action: string;
  actor?: { id: string; email: string } | null;
  actorEmail?: string; // when there is no known user, e.g. a failed login
  companyId?: string | null;
  entityType?: string;
  entityId?: string;
  details?: Prisma.InputJsonValue;
};

// Awaited on purpose: if the audit entry cannot be written, the action fails too.
export async function audit(entry: AuditEntry, ctx: RequestContext) {
  await db.auditLog.create({
    data: {
      action: entry.action,
      actorUserId: entry.actor?.id ?? null,
      actorEmail: entry.actor?.email ?? entry.actorEmail ?? null,
      companyId: entry.companyId ?? null,
      entityType: entry.entityType ?? null,
      entityId: entry.entityId ?? null,
      details: entry.details,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    },
  });
}
