import { db } from "@/lib/db";
import { canEditPatients, canSeeContactDetails } from "@/lib/permissions";
import { athensParts, athensToUtc } from "@/lib/time";
import type { Actor } from "@/lib/users/manage";
import { ACTIVE_STATUSES } from "./status";

// Top-strip data (DESIGN 6a–6g). "Tomorrow" is the next working day (Friday → Monday).
export function nextWorkingDay(iso: string) {
  const d = new Date(`${iso}T12:00:00Z`);
  do d.setUTCDate(d.getUTCDate() + 1);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
  return d.toISOString().slice(0, 10);
}

const hhmm = (d: Date) => {
  const p = athensParts(d);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
};

// «Επιβεβαιώσεις αύριο»: how many of tomorrow's appointments are confirmed, and the ones
// still to call (with the phone for those who may see it).
export async function confirmations(actor: Actor, companyId: string, todayIso: string) {
  if (!canEditPatients(actor.level) || !actor.companyIds.includes(companyId)) return null;
  const date = nextWorkingDay(todayIso);
  const [y, m, d] = date.split("-").map(Number);
  const appts = await db.appointment.findMany({
    where: { companyId, startsAt: { gte: athensToUtc(y, m, d), lt: athensToUtc(y, m, d + 1) }, status: { in: ACTIVE_STATUSES }, type: { layer: { not: "SURGERY" } } },
    orderBy: { startsAt: "asc" },
    select: { id: true, startsAt: true, status: true, patientId: true, patient: { select: { surname: true, firstName: true } }, type: { select: { labelEl: true } } },
  });
  const pending = appts.filter((a) => a.status === "BOOKED");
  const phones = canSeeContactDetails(actor.level) && pending.length
    ? await db.patientPhone.findMany({ where: { patientId: { in: pending.flatMap((a) => (a.patientId ? [a.patientId] : [])) } }, orderBy: [{ isMain: "desc" }, { sortOrder: "asc" }], select: { patientId: true, number: true } })
    : [];
  return {
    date,
    total: appts.length,
    confirmed: appts.length - pending.length,
    pending: pending.map((a) => ({
      id: a.id,
      time: hhmm(a.startsAt),
      name: a.patient ? `${a.patient.surname} ${a.patient.firstName}`.trim() : null,
      patientId: a.patientId,
      type: a.type.labelEl,
      phone: phones.find((p) => p.patientId === a.patientId)?.number ?? null,
    })),
  };
}
