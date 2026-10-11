import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { canSeeContactDetails } from "@/lib/permissions";
import type { Actor } from "@/lib/users/manage";
import { companyFilter } from "./scope";
import { parseQuery, searchWhere, type ParsedQuery } from "./search";

export const PATIENT_PAGE_SIZE = 50;

export type MatchField = "name" | "code" | "phone" | "email" | "amka";

// Which field made a patient show up (shown as "Ταίριασμα: …" on the Patients page).
export function matchedField(
  q: ParsedQuery,
  p: { number: number; amka?: string | null; phones?: { digits: string }[] },
): MatchField | null {
  switch (q.kind) {
    case "name":
      return "name";
    case "email":
      return "email";
    case "digits":
      if (String(p.number) === q.digits) return "code";
      if (p.amka?.startsWith(q.digits)) return "amka";
      if (p.phones?.length) return "phone";
      return "code";
    default:
      return null;
  }
}

// Alphabetical list, archived patients left out, optionally only those matching a search
// or with a flag. Contact details only for non-Guests.
export async function listPatients(
  actor: Actor,
  opts: { page: number; companyId?: string; q?: string; flagged?: boolean },
) {
  const parsed = parseQuery(opts.q ?? "");
  const match = searchWhere(actor, parsed);
  const where: Prisma.PatientWhereInput = {
    companyId: { in: companyFilter(actor, opts.companyId) },
    archivedAt: null,
    ...(opts.flagged && { flag: { not: "NONE" } }),
    ...match,
  };
  const contacts = canSeeContactDetails(actor.level);
  const page = Math.max(1, opts.page);
  const [total, rows] = await Promise.all([
    db.patient.count({ where }),
    db.patient.findMany({
      where,
      orderBy: [{ sortName: "asc" }, { number: "asc" }],
      skip: (page - 1) * PATIENT_PAGE_SIZE,
      take: PATIENT_PAGE_SIZE,
      select: {
        id: true,
        number: true,
        surname: true,
        firstName: true,
        fatherName: true,
        birthDate: true,
        flag: true,
        infectiousDiseases: true,
        registeredAt: true,
        company: { select: { code: true, name: true } },
        ...(contacts && {
          amka: true,
          phones: { orderBy: { sortOrder: "asc" }, select: { number: true, digits: true }, take: 3 },
          emails: { orderBy: { sortOrder: "asc" }, select: { email: true }, take: 1 },
        }),
      },
    }),
  ]);
  return {
    total,
    page,
    pages: Math.max(1, Math.ceil(total / PATIENT_PAGE_SIZE)),
    rows: rows.map((r) => ({ ...r, match: matchedField(parsed, r) })),
  };
}

// Patients this user opened most recently (from the audit log), newest first.
export async function recentlyOpened(actor: Actor, limit = 8) {
  const views = await db.auditLog.groupBy({
    by: ["entityId"],
    where: { actorUserId: actor.id, action: "patient.viewed", entityId: { not: null } },
    _max: { at: true },
    orderBy: { _max: { at: "desc" } },
    take: limit * 2,
  });
  const ids = views.map((v) => v.entityId!);
  const patients = await db.patient.findMany({
    where: { id: { in: ids }, companyId: { in: companyFilter(actor) }, archivedAt: null },
    select: { id: true, number: true, surname: true, firstName: true, flag: true, company: { select: { code: true } } },
  });
  return ids
    .map((id) => patients.find((p) => p.id === id))
    .filter((p) => p !== undefined)
    .slice(0, limit);
}
