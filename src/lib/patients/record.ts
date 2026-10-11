import { db } from "@/lib/db";
import { audit, type RequestContext } from "@/lib/audit";
import { canArchivePatients, canSeeContactDetails } from "@/lib/permissions";
import type { Actor } from "@/lib/users/manage";
import { companyFilter } from "./scope";

// Opening a patient record: only in the user's companies, and always written to the
// audit log (CLAUDE.md). Guests get no contact details, no AMKA/ΑΦΜ and no date of birth.
export async function openPatient(actor: Actor, id: string, ctx: RequestContext) {
  const p = await db.patient.findFirst({
    where: { id, companyId: { in: companyFilter(actor) } },
    include: {
      company: { select: { id: true, code: true, name: true } },
      flagReasons: { include: { listItem: { select: { id: true, label: true } } } },
      phones: { orderBy: { sortOrder: "asc" } },
      emails: { orderBy: { sortOrder: "asc" } },
      maritalStatus: { select: { label: true } },
      referralSource: { select: { label: true } },
      taxOffice: { select: { label: true } },
      treatingDoctor: { select: { name: true } },
    },
  });
  if (!p || (p.archivedAt && !canArchivePatients(actor.level))) return null;
  await audit({ action: "patient.viewed", actor, companyId: p.companyId, entityType: "Patient", entityId: p.id }, ctx);

  const shared = {
    id: p.id,
    number: p.number,
    company: p.company,
    surname: p.surname,
    firstName: p.firstName,
    fatherName: p.fatherName,
    // Guests see the age, never the date itself.
    ageFrom: p.birthDate,
    sex: p.sex,
    maritalStatus: p.maritalStatus?.label ?? null,
    occupation: p.occupation,
    language: p.language,
    registeredAt: p.registeredAt,
    treatingDoctor: p.treatingDoctor?.name ?? null,
    infectiousDiseases: p.infectiousDiseases,
    archivedAt: p.archivedAt,
  };
  // Staff notes, not clinical data: Guests (research) do not see them.
  const staff = {
    comments: p.comments,
    flag: p.flag,
    flagNote: p.flagNote,
    flagSetAt: p.flagSetAt,
    flagReasons: p.flagReasons.map((r) => r.listItem),
  };
  if (!canSeeContactDetails(actor.level)) {
    return { ...shared, comments: null, flag: "NONE" as const, flagNote: null, flagSetAt: null, flagReasons: [], contacts: null };
  }
  return {
    ...shared,
    ...staff,
    contacts: {
      birthDate: p.birthDate,
      amka: p.amka,
      afm: p.afm,
      taxOffice: p.taxOffice?.label ?? null,
      phones: p.phones.map(({ number, type, isMain }) => ({ number, type, isMain })),
      emails: p.emails.map((e) => e.email),
      area: p.area,
      address: p.address,
      city: p.city,
      postcode: p.postcode,
      country: p.country,
      referralSource: p.referralSource?.label ?? null,
      referralNote: p.referralNote,
      eprescriptionCity: p.eprescriptionCity,
      eprescriptionPhone: p.eprescriptionPhone,
      marketingConsent: p.marketingConsent,
      ghlContactId: p.ghlContactId,
      // Raw values for the edit form.
      form: {
        maritalStatusId: p.maritalStatusId,
        referralSourceId: p.referralSourceId,
        taxOfficeId: p.taxOfficeId,
        treatingDoctorId: p.treatingDoctorId,
      },
    },
  };
}
export type PatientView = NonNullable<Awaited<ReturnType<typeof openPatient>>>;
