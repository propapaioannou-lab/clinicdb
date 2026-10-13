import { db } from "@/lib/db";

// «+ Ραντεβού» from the patient record (6a-9). All lookups stay inside the company.

const when = new Intl.DateTimeFormat("el-GR", { timeZone: "Europe/Athens", weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

// The menu on the record: a patient never seen gets the new-patient type (first), others
// the rest; plus any upcoming appointment ("Έχει ήδη: …").
export async function bookingMenu(companyId: string, patientId: string) {
  const [types, seen, next] = await Promise.all([
    db.appointmentType.findMany({ where: { companyId, isActive: true, NOT: { layer: "SURGERY" } }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    Promise.all([
      db.visit.count({ where: { patientId } }),
      db.appointment.count({ where: { patientId, status: { in: ["DONE", "TO_PAY", "WITH_DOCTOR"] } } }),
    ]).then(([v, a]) => v + a > 0),
    db.appointment.findFirst({ where: { companyId, patientId, startsAt: { gte: new Date() }, status: { in: ["BOOKED", "CONFIRMED"] } }, orderBy: { startsAt: "asc" }, include: { type: { select: { labelEl: true } } } }),
  ]);
  return {
    types: types.filter((x) => x.forNewPatients !== seen).concat(seen ? [] : types.filter((x) => !x.forNewPatients)).map((x) => ({ id: x.id, label: x.labelEl, minutes: x.defaultMinutes, color: x.color })),
    upcoming: next ? `${when.format(next.startsAt)} · ${next.type.labelEl}` : null,
  };
}

// The patient and type the calendar carries (?bookFor=&type=), with any upcoming appointment.
export async function bookingFor(companyId: string, patientId: string, typeId: string) {
  const [p, ty] = await Promise.all([
    db.patient.findFirst({ where: { id: patientId, companyId, archivedAt: null }, select: { id: true, firstName: true, surname: true } }),
    db.appointmentType.findFirst({ where: { id: typeId, companyId, isActive: true, NOT: { layer: "SURGERY" } } }),
  ]);
  if (!p || !ty) return null;
  const next = await db.appointment.findFirst({
    where: { companyId, patientId, startsAt: { gte: new Date() }, status: { in: ["BOOKED", "CONFIRMED"] } },
    orderBy: { startsAt: "asc" },
    include: { type: { select: { labelEl: true } } },
  });
  return {
    patientId: p.id,
    typeId: ty.id,
    minutes: ty.defaultMinutes,
    name: `${p.firstName} ${p.surname}`.trim(),
    who: `${p.firstName} ${p.surname.slice(0, 1)}. · ${ty.labelEl} ${ty.defaultMinutes}′`,
    upcoming: next ? `${when.format(next.startsAt)} · ${next.type.labelEl}` : null,
  };
}
