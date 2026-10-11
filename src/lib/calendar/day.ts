import { db } from "@/lib/db";
import { canSeeContactDetails } from "@/lib/permissions";
import { patientCode } from "@/lib/patients/format";
import { athensParts, athensToUtc } from "@/lib/time";
import type { Actor } from "@/lib/users/manage";
import { listAppointments } from "./appointments";
import { holidayOn } from "./holidays";
import { hoursOf, minutesOf } from "./hours";
import { ACTIVE_STATUSES } from "./status";

// One calendar day, ready to draw (DESIGN 6a–6f, secretary day). Times are minutes from
// Athens midnight so the browser never has to deal with time zones.

export type DayAppointment = {
  id: string;
  resourceId: string;
  start: number;
  end: number;
  time: string;
  patient: { id: string; name: string; short: string; code: string; flag: string; phone: string | null } | null;
  type: { id: string; label: string; color: string; layer: string };
  reason: string | null;
  status: string;
  room: string | null;
  arrivedAt: string | null;
  active: boolean;
};
export type DayData = NonNullable<Awaited<ReturnType<typeof calendarDay>>>;

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const clockOf = (d: Date) => {
  const p = athensParts(d);
  return p.hour * 60 + p.minute;
};

export async function calendarDay(actor: Actor, companyId: string, isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const from = athensToUtc(y, m, d);
  const to = athensToUtc(y, m, d + 1);
  const weekday = athensParts(from).weekday || 7;
  const contacts = canSeeContactDetails(actor.level);
  const [resources, appts, blocks] = await Promise.all([
    db.resource.findMany({ where: { companyId, isActive: true, NOT: { kind: "OPERATING_ROOM" } }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    listAppointments(actor, companyId, from, to),
    db.calendarBlock.findMany({ where: { companyId, startsAt: { lt: to }, endsAt: { gt: from } } }),
  ]);
  if (!appts) return null;
  const minuteIn = (t: Date) => (t <= from ? 0 : t >= to ? 24 * 60 : clockOf(t));
  // "Ήρθε 11:38": when the patient arrived.
  const arrivals = await db.appointmentEvent.findMany({
    where: { appointmentId: { in: appts.map((a) => a.id) }, toStatus: "ARRIVED" },
    orderBy: { at: "desc" },
    select: { appointmentId: true, at: true },
  });
  const phones = contacts
    ? await db.patientPhone.findMany({ where: { patientId: { in: appts.flatMap((a) => (a.patientId ? [a.patientId] : [])) } }, orderBy: [{ isMain: "desc" }, { sortOrder: "asc" }], select: { patientId: true, number: true } })
    : [];
  const company = await db.company.findUniqueOrThrow({ where: { id: companyId }, select: { code: true } });

  const appointments: DayAppointment[] = appts.map((a) => {
    const arrived = arrivals.find((x) => x.appointmentId === a.id);
    return {
      id: a.id,
      resourceId: a.resourceId,
      start: minuteIn(a.startsAt),
      end: minuteIn(a.endsAt),
      time: hhmm(clockOf(a.startsAt)),
      patient: a.patient
        ? {
            id: a.patient.id,
            name: `${a.patient.surname} ${a.patient.firstName}`.trim(),
            short: `${a.patient.firstName ? `${a.patient.firstName} ` : ""}${a.patient.surname.slice(0, 1)}.`,
            code: patientCode(a.patient.number, company.code),
            flag: a.patient.flag,
            phone: phones.find((p) => p.patientId === a.patient!.id)?.number ?? null,
          }
        : null,
      type: { id: a.type.id, label: a.type.labelEl, color: a.type.color, layer: a.type.layer },
      reason: a.reason,
      status: a.status,
      room: a.room,
      arrivedAt: arrived ? hhmm(clockOf(arrived.at)) : null,
      active: ACTIVE_STATUSES.includes(a.status),
    };
  });

  const holiday = holidayOn(isoDate) ?? null;
  const columns = resources.map((r) => {
    const hours = holiday ? [] : hoursOf(r.hours).filter((h) => h.day === weekday).map((h) => ({ from: minutesOf(h.from), to: minutesOf(h.to) }));
    const mine = appointments.filter((a) => a.resourceId === r.id);
    const myBlocks = blocks
      .filter((b) => !b.resourceId || b.resourceId === r.id)
      .map((b) => ({ id: b.id, start: minuteIn(b.startsAt), end: minuteIn(b.endsAt), label: b.label, kind: b.kind }));
    // Free gaps: working hours minus appointments and blocks (≥ 15 minutes).
    const busy = [...mine.filter((a) => a.active), ...myBlocks].map((x) => [x.start, x.end] as const).sort((a, b) => a[0] - b[0]);
    const gaps: { start: number; end: number }[] = [];
    for (const h of hours) {
      let cur = h.from;
      for (const [s, e] of busy) {
        if (e <= cur || s >= h.to) continue;
        if (s > cur) gaps.push({ start: cur, end: Math.min(s, h.to) });
        cur = Math.max(cur, e);
      }
      if (cur < h.to) gaps.push({ start: cur, end: h.to });
    }
    const free = gaps.filter((g) => g.end - g.start >= 15);
    return {
      id: r.id,
      label: r.label,
      kind: r.kind,
      hours,
      blocks: myBlocks,
      gaps: free,
      count: mine.filter((a) => a.active).length,
      freeMinutes: free.reduce((n, g) => n + g.end - g.start, 0),
    };
  });

  // Visible range: working hours of the day, widened to anything booked outside them.
  const edges = [...columns.flatMap((c) => c.hours.flatMap((h) => [h.from, h.to])), ...appointments.flatMap((a) => [a.start, a.end])];
  const startHour = edges.length ? Math.floor(Math.min(...edges) / 60) : 9;
  const endHour = edges.length ? Math.ceil(Math.max(...edges) / 60) : 21;

  // Tomorrow's confirmations (secretary side panel).
  const tFrom = to;
  const tTo = athensToUtc(y, m, d + 2);
  const tomorrow = await db.appointment.groupBy({
    by: ["status"],
    where: { companyId, startsAt: { gte: tFrom, lt: tTo }, status: { in: ACTIVE_STATUSES } },
    _count: true,
  });
  const tomorrowTotal = tomorrow.reduce((n, g) => n + g._count, 0);
  const tomorrowConfirmed = tomorrow.filter((g) => g.status !== "BOOKED").reduce((n, g) => n + g._count, 0);

  return {
    date: isoDate,
    holiday,
    startHour: Math.min(startHour, 9),
    endHour: Math.max(endHour, Math.min(startHour, 9) + 8),
    columns,
    appointments,
    tomorrow: { total: tomorrowTotal, confirmed: tomorrowConfirmed },
  };
}
