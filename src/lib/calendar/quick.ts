import { db } from "@/lib/db";
import type { RequestContext } from "@/lib/audit";
import { canEditPatients, canSeeContactDetails } from "@/lib/permissions";
import { findDuplicates } from "@/lib/patients/duplicates";
import { confirmDetails, createPatient, type PatientInput } from "@/lib/patients/manage";
import { patientSearchName, phoneDigits } from "@/lib/patients/normalize";
import { quickSearch } from "@/lib/patients/search";
import type { Actor } from "@/lib/users/manage";
import { createAppointment, setAppointmentStatus } from "./appointments";
import { maskPhone, splitName } from "./names";
import { ACTIVE_STATUSES } from "./status";

export { maskPhone, splitName };

// Quick booking and the arrival check (calendar v2, 6a-6; DESIGN 6g panels 1, 2, 5).

export const TAG_TO_CONFIRM = "to_confirm";
export const TAG_NO_PHONE = "no_phone";

const monthYear = (d: Date | null | undefined) => (d ? `${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}` : null);

export type BookingPatient = {
  id: string;
  name: string;
  phone: string | null; // masked
  lastVisit: string | null; // MM/YYYY
  upcoming: string | null; // ISO date of the next kept appointment
  flag: "NONE" | "YELLOW" | "RED";
  flagReasons: string[];
  tags: string[];
};

async function describe(companyId: string, ids: string[], contacts: boolean): Promise<BookingPatient[]> {
  if (!ids.length) return [];
  const now = new Date();
  const [rows, visits, past, future] = await Promise.all([
    db.patient.findMany({
      where: { id: { in: ids }, companyId },
      select: {
        id: true, surname: true, firstName: true, flag: true, tags: true,
        flagReasons: { select: { listItem: { select: { label: true } } } },
        phones: { where: { isMain: true }, select: { number: true }, take: 1 },
      },
    }),
    db.visit.groupBy({ by: ["patientId"], where: { patientId: { in: ids } }, _max: { startedAt: true } }),
    db.appointment.groupBy({ by: ["patientId"], where: { patientId: { in: ids }, startsAt: { lt: now }, status: { in: ["DONE", "TO_PAY"] } }, _max: { startsAt: true } }),
    db.appointment.groupBy({ by: ["patientId"], where: { patientId: { in: ids }, startsAt: { gte: now }, status: { in: ACTIVE_STATUSES } }, _min: { startsAt: true } }),
  ]);
  return ids.flatMap((id) => {
    const p = rows.find((r) => r.id === id);
    if (!p) return [];
    const v = visits.find((x) => x.patientId === id)?._max.startedAt;
    const a = past.find((x) => x.patientId === id)?._max.startsAt;
    const last = v && a ? (v > a ? v : a) : (v ?? a);
    return [{
      id,
      name: `${p.firstName} ${p.surname}`.trim(),
      phone: contacts ? maskPhone(p.phones[0]?.number ?? null) : null,
      lastVisit: monthYear(last),
      upcoming: future.find((x) => x.patientId === id)?._min.startsAt?.toISOString() ?? null,
      flag: p.flag,
      flagReasons: p.flagReasons.map((f) => f.listItem.label),
      tags: p.tags,
    }];
  });
}

// One field: name or phone, accents and Greek/Latin letters alike (the normal search).
export async function bookingSearch(actor: Actor, companyId: string, q: string): Promise<BookingPatient[] | null> {
  if (!canEditPatients(actor.level) || !actor.companyIds.includes(companyId)) return null;
  const rows = await quickSearch(actor, q, companyId);
  return describe(companyId, rows.slice(0, 6).map((r) => r.id), canSeeContactDetails(actor.level));
}

// «Μήπως υπάρχει ήδη;» — by mobile; with no mobile, by name (SPEC §4c quick booking).
export async function quickDuplicates(actor: Actor, companyId: string, raw: { name?: string; mobile?: string; email?: string }, excludeId?: string) {
  if (!canEditPatients(actor.level) || !actor.companyIds.includes(companyId)) return null;
  const { firstName, surname } = splitName(raw.name ?? "");
  const mobile = raw.mobile?.trim() ?? "";
  const byPhone = phoneDigits(mobile).length >= 8;
  if (!byPhone && surname.length < 3) return [];
  const found = await findDuplicates(
    companyId,
    { surname: byPhone ? "" : surname, firstName: byPhone ? "" : firstName, birthDate: null, amka: null, phones: byPhone ? [{ number: mobile, type: "MOBILE", isMain: true }] : [], emails: [] },
    excludeId,
  );
  const key = patientSearchName({ surname, firstName });
  const hits = found
    .filter((d) => (byPhone ? d.reasons.includes("phone") : d.reasons.some((r) => r === "similar_name" || r === "name_dob")))
    // The same name first, then the near spellings.
    .sort((x, y) => Number(patientSearchName(y) === key) - Number(patientSearchName(x) === key));
  const described = await describe(companyId, hits.slice(0, 3).map((d) => d.id), canSeeContactDetails(actor.level));
  return described.map((d) => ({ ...d, birthYear: hits.find((h) => h.id === d.id)?.birthDate?.getUTCFullYear() ?? null, by: byPhone ? ("phone" as const) : ("name" as const) }));
}

const blankPatient = (firstName: string, surname: string, mobile: string, email: string): PatientInput => ({
  surname, firstName, fatherName: null, birthDate: null, sex: null, maritalStatusId: null, occupation: null, referralSourceId: null, referralNote: null,
  language: "EL", area: null, address: null, city: null, postcode: null, country: null, amka: null, afm: null, taxOfficeId: null,
  eprescriptionCity: null, eprescriptionPhone: null, treatingDoctorId: null, ghlContactId: null,
  phones: mobile ? [{ number: mobile, type: "MOBILE", isMain: true }] : [], emails: email ? [email] : [],
});

// Book for an existing patient, or for a new one with only a name (mobile and email
// optional). A new patient always gets the new-patient type and the tags
// «προς επιβεβαίωση» (+ «χωρίς τηλέφωνο»). The time is checked before the patient is
// created, so a refused booking leaves nothing behind.
export async function quickBook(actor: Actor, raw: Record<string, unknown>, ctx: RequestContext) {
  const np = raw.newPatient as { name?: string; mobile?: string; email?: string } | undefined;
  if (!np) return createAppointment(actor, raw, ctx);
  const resource = typeof raw.resourceId === "string" ? await db.resource.findFirst({ where: { id: raw.resourceId, companyId: { in: actor.companyIds } } }) : null;
  if (!resource) return { ok: false as const, error: "not_found" as const };
  const first = await db.appointmentType.findFirst({ where: { companyId: resource.companyId, isActive: true, forNewPatients: true }, orderBy: { sortOrder: "asc" } });
  const booking = { ...raw, typeId: first?.id ?? raw.typeId, patientId: null };
  const dry = await createAppointment(actor, { ...booking, dryRun: true }, ctx);
  if (!dry.ok) return dry;
  const { firstName, surname } = splitName(np.name ?? "");
  const mobile = np.mobile?.trim() ?? "";
  const email = np.email?.trim() ?? "";
  const tags = [TAG_TO_CONFIRM, ...(mobile ? [] : [TAG_NO_PHONE])];
  const others = Array.isArray(raw.notDuplicateOf) ? raw.notDuplicateOf.filter((x): x is string => typeof x === "string").slice(0, 5) : [];
  const p = await createPatient(actor, resource.companyId, blankPatient(firstName, surname, mobile, email), ctx, { tags, notDuplicateOf: others });
  if (!p.ok) return { ok: false as const, error: "invalid_value" as const, patientError: p.error };
  const r = await createAppointment(actor, { ...booking, patientId: p.id }, ctx);
  return r.ok ? { ...r, patientId: p.id } : r;
}

// Arrival (DESIGN 6g panel 5): for tagged patients the first step is «Επιβεβαίωση
// στοιχείων»; it may be skipped (the tags stay). Either way the patient is then waiting.
export async function arrive(actor: Actor, appointmentId: string, raw: { confirm?: { firstName?: string; surname?: string; mobile?: string; email?: string }; skip?: boolean }, ctx: RequestContext) {
  const a = await db.appointment.findFirst({ where: { id: appointmentId, companyId: { in: actor.companyIds } }, select: { patientId: true } });
  if (!a) return { ok: false as const, error: "not_found" as const };
  if (raw.confirm && a.patientId) {
    const r = await confirmDetails(actor, a.patientId, raw.confirm, ctx);
    if (!r.ok) return { ok: false as const, error: "invalid_value" as const, patientError: r.error };
  }
  return setAppointmentStatus(actor, appointmentId, "ARRIVED", { note: { detailsCheck: raw.confirm ? "confirmed" : raw.skip ? "skipped" : "none" } }, ctx);
}

// Can this patient be told about the appointment? (no mobile and no email → no).
export async function reachOf(patientIds: string[]) {
  const [phones, emails] = await Promise.all([
    db.patientPhone.findMany({ where: { patientId: { in: patientIds }, type: "MOBILE" }, select: { patientId: true } }),
    db.patientEmail.findMany({ where: { patientId: { in: patientIds } }, select: { patientId: true } }),
  ]);
  return new Map(patientIds.map((id) => [id, phones.some((p) => p.patientId === id) ? "phone" : emails.some((e) => e.patientId === id) ? "email" : "none"] as const));
}
