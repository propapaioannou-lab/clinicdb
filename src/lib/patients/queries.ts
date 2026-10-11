import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { canSeeContactDetails } from "@/lib/permissions";
import type { Actor } from "@/lib/users/manage";
import { companyFilter } from "./scope";
import { parseQuery, searchWhere } from "./search";

export const PATIENT_PAGE_SIZE = 50;

// Alphabetical list, archived patients left out, optionally only those matching a search.
// Contact details only for non-Guests.
export async function listPatients(actor: Actor, opts: { page: number; companyId?: string; q?: string }) {
  const match = opts.q ? searchWhere(actor, parseQuery(opts.q)) : null;
  const where: Prisma.PatientWhereInput = {
    companyId: { in: companyFilter(actor, opts.companyId) },
    archivedAt: null,
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
        company: { select: { code: true, name: true } },
        ...(contacts && {
          city: true,
          phones: { where: { isMain: true }, select: { number: true }, take: 1 },
        }),
      },
    }),
  ]);
  return { total, page, pages: Math.max(1, Math.ceil(total / PATIENT_PAGE_SIZE)), rows };
}

export async function listUserCompanies(actor: Actor) {
  return db.company.findMany({ where: { id: { in: actor.companyIds } }, orderBy: { code: "desc" } });
}
