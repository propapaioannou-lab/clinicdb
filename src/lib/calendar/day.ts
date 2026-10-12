import { db } from "@/lib/db";
import { canSeeContactDetails } from "@/lib/permissions";
import { patientCode } from "@/lib/patients/format";
import { athensParts, athensToUtc } from "@/lib/time";
import type { Actor } from "@/lib/users/manage";
import { listAppointments } from "./appointments";
import { holidayOn } from "./holidays";
import { roomsOf } from "./rooms";
import { buildScale } from "./bands";
import { calendarConfigOf } from "./config";
import { dayRules, hoursOf, type Span } from "./hours";
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
  statusAt: string | null; // when it entered its current status ("από 11:06")
  active: boolean;
  visitId: string | null;
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
  const [resources, appts, blocks, rooms, cfg] = await Promise.all([
    // Rooms (treatment/conference) are where patients wait for the doctor, not columns.
    db.resource.findMany({ where: { companyId, isActive: true, kind: { notIn: ["OPERATING_ROOM", "ROOM"] } }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    listAppointments(actor, companyId, from, to),
    db.calendarBlock.findMany({ where: { companyId, startsAt: { lt: to }, endsAt: { gt: from } } }),
    roomsOf(companyId),
    calendarConfigOf(companyId),
  ]);
  if (!appts) return null;
  const minuteIn = (t: Date) => (t <= from ? 0 : t >= to ? 24 * 60 : clockOf(t));
  // "Ήρθε 11:38": when the patient arrived; and when each entered its current status.
  const events = await db.appointmentEvent.findMany({
    where: { appointmentId: { in: appts.map((a) => a.id) }, toStatus: { not: null } },
    orderBy: { at: "desc" },
    select: { appointmentId: true, at: true, toStatus: true },
  });
  const arrivals = events.filter((e) => e.toStatus === "ARRIVED");
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
      statusAt: (() => { const e = events.find((x) => x.appointmentId === a.id && x.toStatus === a.status); return e ? hhmm(clockOf(e.at)) : null; })(),
      active: ACTIVE_STATUSES.includes(a.status),
      visitId: a.visitId,
    };
  });

  const holiday = holidayOn(isoDate) ?? null;
  const columns = resources.map((r) => {
    // Normal hours, the flex zones around them («εκτός ωραρίου +30′») and, for doctors, the
    // surgery window. A holiday closes everything.
    const rules = dayRules(hoursOf(r.hours), cfg, weekday, { surgeryWindow: r.kind === "DOCTOR" });
    const hours = holiday ? [] : rules.normal;
    const flex = holiday ? [] : rules.flex;
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
    // Free parts of the flex zones (booked with one extra click).
    const flexGaps: { start: number; end: number }[] = [];
    for (const f of flex) {
      let cur = f.from;
      for (const [s, e] of busy) {
        if (e <= cur || s >= f.to) continue;
        if (s > cur) flexGaps.push({ start: cur, end: Math.min(s, f.to) });
        cur = Math.max(cur, e);
      }
      if (cur < f.to) flexGaps.push({ start: cur, end: f.to });
    }
    return {
      id: r.id,
      label: r.label,
      kind: r.kind,
      hours,
      flex,
      surgery: rules.surgery,
      blocks: myBlocks,
      gaps: free,
      flexGaps: flexGaps.filter((g) => g.end - g.start >= 10),
      count: mine.filter((a) => a.active && a.type.layer !== "SURGERY").length,
      surgeries: mine.filter((a) => a.active && a.type.layer === "SURGERY").length,
      freeMinutes: free.reduce((n, g) => n + g.end - g.start, 0),
    };
  });

  // Two bands (DESIGN 6a–6g): the same on every day of the practice, so the layout does
  // not jump between days; widened to anything booked outside them.
  const scale = buildScale(scaleInput(resources.map((r) => r.hours), resources.map((r) => r.kind), cfg, appointments.filter((a) => a.active)), "day");

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
    scale,
    columns,
    rooms,
    appointments,
    tomorrow: { total: tomorrowTotal, confirmed: tomorrowConfirmed },
    tomorrowDate: new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10),
  };
}

// What the two bands are built from: the surgery window and office hours (+ flex) of the
// whole week, so every day of the practice has the same layout.
export function scaleInput(hoursRaw: unknown[], kinds: string[], cfg: Parameters<typeof dayRules>[1], items: { start: number; end: number }[]) {
  const surgery: Span[] = [];
  const office: Span[] = [];
  hoursRaw.forEach((raw, i) => {
    for (let wd = 1; wd <= 7; wd++) {
      const r = dayRules(hoursOf(raw), cfg, wd, { surgeryWindow: kinds[i] === "DOCTOR" });
      surgery.push(...r.surgery);
      office.push(...r.normal, ...r.flex);
    }
  });
  return { surgery, office, items: items.map((a) => ({ from: a.start, to: a.end })) };
}
