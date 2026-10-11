import { db } from "@/lib/db";
import { audit, type RequestContext } from "@/lib/audit";
import { canArchivePatients, canSeeContactDetails } from "@/lib/permissions";
import type { Actor } from "@/lib/users/manage";
import { companyFilter } from "./scope";

// Opening a patient record: only in the user's companies, and always written to the
// audit log (CLAUDE.md). Guests get no contact details and no date of birth.
export async function openPatient(actor: Actor, id: string, ctx: RequestContext) {
  const p = await db.patient.findFirst({
    where: { id, companyId: { in: companyFilter(actor) } },
    include: {
      company: { select: { name: true } },
      flagReasons: { include: { listItem: { select: { label: true } } } },
    },
  });
  if (!p || (p.archivedAt && !canArchivePatients(actor.level))) return null;
  await audit({ action: "patient.viewed", actor, companyId: p.companyId, entityType: "Patient", entityId: p.id }, ctx);

  const contacts = canSeeContactDetails(actor.level);
  return {
    id: p.id,
    number: p.number,
    company: p.company.name,
    surname: p.surname,
    firstName: p.firstName,
    fatherName: p.fatherName,
    birthDate: contacts ? p.birthDate : null,
    // Guests see age, never the date itself.
    ageFrom: p.birthDate,
    amka: contacts ? p.amka : null,
    flag: p.flag,
    flagNote: p.flagNote,
    flagReasons: p.flagReasons.map((r) => r.listItem.label),
    infectiousDiseases: p.infectiousDiseases,
    archivedAt: p.archivedAt,
  };
}
