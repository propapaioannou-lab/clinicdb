import { db } from "@/lib/db";
import { audit, type RequestContext } from "@/lib/audit";
import type { AppointmentStatus, Prisma } from "@/generated/prisma/client";
import { canEditPatients } from "@/lib/permissions";
import { athensIsoDate, athensParts, athensToUtc } from "@/lib/time";
import type { Actor } from "@/lib/users/manage";
import { holidayOn } from "./holidays";
import { calendarConfigOf } from "./config";
import { dayRules, hoursOf, minutesOf, zoneOf } from "./hours";
import { ACTIVE_STATUSES, checkTransition, type StatusRefusal } from "./status";

// Calendar core (SPEC §4c, Phase 6a): booking, moving, status changes, clash checks and
// free slots. Practice and Spa are separate calendars: everything is per company.

export type Problem =
  | { kind: "appointment"; id: string; startsAt: Date; endsAt: Date; label: string }
  | { kind: "patient"; id: string; startsAt: Date; endsAt: Date; label: string }
  | { kind: "block"; startsAt: Date; endsAt: Date; label: string }
  | { kind: "holiday"; label: string }
  | { kind: "flex" } // just outside office hours: one extra click, no reason
  | { kind: "outside_hours" } // override with a reason
  | { kind: "weekend" } // override with a reason
  | { kind: "past" };

// Problems that need a written reason before booking anyway (SPEC §4c hours).
export const NEEDS_REASON: Problem["kind"][] = ["outside_hours", "weekend"];

export type CalendarError = "forbidden" | "not_found" | "invalid_value" | "clash" | "reason_needed" | StatusRefusal;
type Fail = { ok: false; error: CalendarError; problems?: Problem[]; suggestions?: Date[] };
const fail = (error: CalendarError, extra: Partial<Fail> = {}): Fail => ({ ok: false, error, ...extra });

const MIN_MINUTES = 5;
const MAX_MINUTES = 12 * 60;
const overlaps = (a: { startsAt: Date; endsAt: Date }, s: Date, e: Date) => a.startsAt < e && a.endsAt > s;

// "2026-10-12" + "10:30" (Athens) → instant.
export function athensSlot(date: unknown, time: unknown): Date | null {
  const d = typeof date === "string" ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(date) : null;
  const t = typeof time === "string" ? /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(time) : null;
  if (!d || !t) return null;
  const out = athensToUtc(+d[1], +d[2], +d[3], +t[1], +t[2]);
  return athensIsoDate(out) === `${d[1]}-${d[2]}-${d[3]}` ? out : null;
}

const minutesOfDay = (d: Date) => {
  const p = athensParts(d);
  return p.hour * 60 + p.minute;
};
// Mon=1 … Sun=7
const weekdayOf = (d: Date) => athensParts(d).weekday || 7;

// Everything that makes [start, end) a bad time for this resource (and patient).
export async function checkSlot(
  companyId: string,
  resourceId: string,
  startsAt: Date,
  endsAt: Date,
  opts: { exceptId?: string; patientId?: string | null; now?: Date; surgery?: boolean } = {},
): Promise<Problem[]> {
  const problems: Problem[] = [];
  const resource = await db.resource.findFirst({ where: { id: resourceId, companyId } });
  if (!resource) return problems;
  if (startsAt < (opts.now ?? new Date())) problems.push({ kind: "past" });
  const day = athensIsoDate(startsAt);
  const holiday = holidayOn(day);
  if (holiday) problems.push({ kind: "holiday", label: holiday });
  // Office hours (or the surgery window for surgeries): the whole appointment must sit
  // inside one working range of that day; the flex zones around office hours are a
  // lighter warning.
  const s = minutesOfDay(startsAt);
  const e = athensIsoDate(endsAt) === day ? minutesOfDay(endsAt) : 24 * 60;
  const weekday = weekdayOf(startsAt);
  const rules = dayRules(hoursOf(resource.hours), await calendarConfigOf(companyId), weekday, { surgeryWindow: true });
  const zone = zoneOf(rules, weekday, s, e, { surgery: opts.surgery });
  if (zone === "flex") problems.push({ kind: "flex" });
  if (zone === "off") problems.push({ kind: "outside_hours" });
  if (zone === "weekend") problems.push({ kind: "weekend" });
  const [appts, blocks, mine] = await Promise.all([
    db.appointment.findMany({
      where: { companyId, resourceId, status: { in: ACTIVE_STATUSES }, startsAt: { lt: endsAt }, endsAt: { gt: startsAt }, ...(opts.exceptId && { NOT: { id: opts.exceptId } }) },
      include: { patient: { select: { surname: true, firstName: true } }, type: { select: { labelEl: true } } },
    }),
    db.calendarBlock.findMany({ where: { companyId, OR: [{ resourceId }, { resourceId: null }], startsAt: { lt: endsAt }, endsAt: { gt: startsAt } } }),
    opts.patientId
      ? db.appointment.findMany({
          where: { companyId, patientId: opts.patientId, status: { in: ACTIVE_STATUSES }, startsAt: { lt: endsAt }, endsAt: { gt: startsAt }, NOT: [{ resourceId }, ...(opts.exceptId ? [{ id: opts.exceptId }] : [])] },
          include: { resource: { select: { label: true } } },
        })
      : [],
  ]);
  for (const a of appts) {
    const name = a.patient ? `${a.patient.surname} ${a.patient.firstName}`.trim() : a.type.labelEl;
    problems.push({ kind: "appointment", id: a.id, startsAt: a.startsAt, endsAt: a.endsAt, label: name });
  }
  for (const b of blocks) problems.push({ kind: "block", startsAt: b.startsAt, endsAt: b.endsAt, label: b.label ?? b.kind });
  for (const a of mine) problems.push({ kind: "patient", id: a.id, startsAt: a.startsAt, endsAt: a.endsAt, label: a.resource.label });
  return problems;
}

// The next free starts (every `step` minutes) for `minutes` on this resource: inside
// office hours, not on a holiday, not over another appointment or a block, not in the past.
export async function freeSlots(
  companyId: string,
  resourceId: string,
  from: Date,
  minutes: number,
  opts: { days?: number; limit?: number; step?: number; now?: Date } = {},
): Promise<Date[]> {
  const { days = 21, limit = 6, step = 15 } = opts;
  const now = opts.now ?? new Date();
  const resource = await db.resource.findFirst({ where: { id: resourceId, companyId } });
  if (!resource) return [];
  const hours = hoursOf(resource.hours);
  const until = new Date(from.getTime() + days * 864e5);
  const [appts, blocks] = await Promise.all([
    db.appointment.findMany({ where: { companyId, resourceId, status: { in: ACTIVE_STATUSES }, startsAt: { lt: until }, endsAt: { gt: from } }, select: { startsAt: true, endsAt: true } }),
    db.calendarBlock.findMany({ where: { companyId, OR: [{ resourceId }, { resourceId: null }], startsAt: { lt: until }, endsAt: { gt: from } }, select: { startsAt: true, endsAt: true } }),
  ]);
  const busy = [...appts, ...blocks];
  const out: Date[] = [];
  const first = athensParts(from);
  for (let i = 0; i < days && out.length < limit; i++) {
    const dayStart = athensToUtc(first.year, first.month, first.day + i);
    const iso = athensIsoDate(dayStart);
    if (holidayOn(iso)) continue;
    const p = athensParts(dayStart);
    for (const h of hours.filter((x) => x.day === (weekdayOf(dayStart) || 7))) {
      for (let m = minutesOf(h.from); m + minutes <= minutesOf(h.to) && out.length < limit; m += step) {
        const s = athensToUtc(p.year, p.month, p.day, Math.floor(m / 60), m % 60);
        const e = new Date(s.getTime() + minutes * 60e3);
        if (s < from || s < now) continue;
        if (busy.some((b) => overlaps(b, s, e))) continue;
        out.push(s);
      }
    }
  }
  return out;
}

// Booking anyway: flex zones need only the extra click (`flex`), other problems need
// `override`, and off-hours / weekend also a written reason.
function refusal(problems: Problem[], raw: Record<string, unknown>): CalendarError | null {
  if (!problems.length) return null;
  if (problems.every((p) => p.kind === "flex") && (raw.flex === true || raw.override === true)) return null;
  if (raw.override !== true) return "clash";
  if (problems.some((p) => NEEDS_REASON.includes(p.kind)) && !text(raw.overrideReason, 200)) return "reason_needed";
  return null;
}

async function scoped(actor: Actor, raw: Record<string, unknown>) {
  const [type, resource] = await Promise.all([
    typeof raw.typeId === "string" ? db.appointmentType.findFirst({ where: { id: raw.typeId, companyId: { in: actor.companyIds }, isActive: true } }) : null,
    typeof raw.resourceId === "string" ? db.resource.findFirst({ where: { id: raw.resourceId, companyId: { in: actor.companyIds }, isActive: true } }) : null,
  ]);
  if (!type || !resource || type.companyId !== resource.companyId) return null;
  return { type, resource, companyId: resource.companyId };
}

const minutesFrom = (raw: unknown, fallback: number) => {
  const n = raw === undefined || raw === null || raw === "" ? fallback : Number(raw);
  return Number.isInteger(n) && n >= MIN_MINUTES && n <= MAX_MINUTES ? n : null;
};
const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) || null : null);
// What was booked anyway, and why — kept in the appointment's history and the audit log.
const overrideDetails = (problems: Problem[], raw: Record<string, unknown>) =>
  problems.length ? { override: problems.map((p) => p.kind), ...(text(raw.overrideReason, 200) && { overrideReason: text(raw.overrideReason, 200) }) } : {};

async function log(
  tx: Prisma.TransactionClient,
  actor: Actor,
  a: { id: string; companyId: string; patientId: string | null; resourceId: string; status?: AppointmentStatus; room?: string | null },
  action: string,
  extra: { fromStatus?: AppointmentStatus; toStatus?: AppointmentStatus; details?: Record<string, unknown> },
  ctx: RequestContext,
) {
  await tx.appointmentEvent.create({
    data: {
      appointmentId: a.id, companyId: a.companyId, action, fromStatus: extra.fromStatus, toStatus: extra.toStatus,
      byId: actor.id, byName: actor.name, details: extra.details as Prisma.InputJsonValue,
    },
  });
  // Live screens learn about it the moment the transaction commits (NOTIFY is sent then).
  const p = a.patientId ? await tx.patient.findUnique({ where: { id: a.patientId }, select: { surname: true, firstName: true } }) : null;
  const event = {
    type: "appointment", companyId: a.companyId, appointmentId: a.id, action,
    status: extra.toStatus ?? a.status ?? "BOOKED", room: extra.toStatus === "READY" ? ((extra.details?.room as string | undefined) ?? a.room ?? null) : null,
    resourceId: (extra.details?.resource as string | undefined) ?? a.resourceId, patientId: a.patientId,
    patientShort: p ? `${p.firstName ? `${p.firstName} ` : ""}${p.surname.slice(0, 1)}.` : null, byName: actor.name, at: new Date().toISOString(),
  };
  await tx.$executeRaw`SELECT pg_notify('clinic_live', ${JSON.stringify(event)})`;
  await audit(
    {
      action: `appointment.${action}`, actor, companyId: a.companyId,
      entityType: a.patientId ? "Patient" : "Appointment", entityId: a.patientId ?? a.id,
      details: { appointmentId: a.id, ...(extra.fromStatus && { from: extra.fromStatus }), ...(extra.toStatus && { to: extra.toStatus }), ...(extra.details ?? {}) } as Prisma.InputJsonValue,
    },
    ctx,
  );
}

// raw: { patientId?, typeId, resourceId, date: "YYYY-MM-DD", time: "HH:MM", minutes?, reason?, override? }
export async function createAppointment(actor: Actor, raw: Record<string, unknown>, ctx: RequestContext): Promise<Fail | { ok: true; id: string; overridden: Problem[] }> {
  if (!canEditPatients(actor.level)) return fail("forbidden");
  const s = await scoped(actor, raw);
  if (!s) return fail("not_found");
  const patientId = typeof raw.patientId === "string" && raw.patientId ? raw.patientId : null;
  if (patientId && !(await db.patient.findFirst({ where: { id: patientId, companyId: s.companyId, archivedAt: null }, select: { id: true } }))) return fail("not_found");
  const startsAt = athensSlot(raw.date, raw.time);
  const minutes = minutesFrom(raw.minutes, s.type.defaultMinutes);
  if (!startsAt || !minutes) return fail("invalid_value");
  const endsAt = new Date(startsAt.getTime() + minutes * 60e3);
  const problems = await checkSlot(s.companyId, s.resource.id, startsAt, endsAt, { patientId, surgery: s.type.layer === "SURGERY" });
  const refused = refusal(problems, raw);
  if (refused) return fail(refused, { problems, suggestions: await freeSlots(s.companyId, s.resource.id, startsAt, minutes) });
  const created = await db.$transaction(async (tx) => {
    const a = await tx.appointment.create({
      data: { companyId: s.companyId, patientId, typeId: s.type.id, resourceId: s.resource.id, startsAt, endsAt, reason: text(raw.reason, 120), createdById: actor.id },
    });
    await log(tx, actor, a, "created", { toStatus: "BOOKED", details: { startsAt: startsAt.toISOString(), minutes, ...overrideDetails(problems, raw) } }, ctx);
    return a;
  });
  return { ok: true, id: created.id, overridden: problems };
}

async function own(actor: Actor, id: string) {
  return db.appointment.findFirst({ where: { id, companyId: { in: actor.companyIds } }, include: { type: true } });
}

// New time, length and/or resource. Clashes are refused unless `override`.
export async function moveAppointment(actor: Actor, id: string, raw: Record<string, unknown>, ctx: RequestContext): Promise<Fail | { ok: true; overridden: Problem[] }> {
  if (!canEditPatients(actor.level)) return fail("forbidden");
  const a = await own(actor, id);
  if (!a || !ACTIVE_STATUSES.includes(a.status) || a.status === "DONE") return fail("not_found");
  const resourceId = typeof raw.resourceId === "string" ? raw.resourceId : a.resourceId;
  if (!(await db.resource.findFirst({ where: { id: resourceId, companyId: a.companyId, isActive: true } }))) return fail("not_found");
  const startsAt = raw.date !== undefined || raw.time !== undefined ? athensSlot(raw.date, raw.time) : a.startsAt;
  const minutes = minutesFrom(raw.minutes, Math.round((a.endsAt.getTime() - a.startsAt.getTime()) / 60e3));
  if (!startsAt || !minutes) return fail("invalid_value");
  const endsAt = new Date(startsAt.getTime() + minutes * 60e3);
  const problems = await checkSlot(a.companyId, resourceId, startsAt, endsAt, { exceptId: id, patientId: a.patientId, surgery: a.type.layer === "SURGERY" });
  const refused = refusal(problems, raw);
  if (refused) return fail(refused, { problems, suggestions: await freeSlots(a.companyId, resourceId, startsAt, minutes) });
  await db.$transaction(async (tx) => {
    await tx.appointment.update({ where: { id }, data: { startsAt, endsAt, resourceId } });
    await log(tx, actor, a, "moved", {
      details: {
        from: a.startsAt.toISOString(), to: startsAt.toISOString(), minutes,
        ...(resourceId !== a.resourceId && { resource: resourceId }), ...overrideDetails(problems, raw),
      },
    }, ctx);
  });
  return { ok: true, overridden: problems };
}

// One step in the status list (SPEC §4c). Pressing the current status again does nothing.
export async function setAppointmentStatus(
  actor: Actor,
  id: string,
  to: AppointmentStatus,
  opts: { room?: string; reason?: string },
  ctx: RequestContext,
): Promise<Fail | { ok: true; changed: boolean }> {
  const a = await own(actor, id);
  if (!a) return fail("not_found");
  if (a.status === to) return { ok: true, changed: false };
  const refusal = checkTransition(actor, a.status, to);
  if (refusal) return fail(refusal);
  const room = to === "READY" ? text(opts.room, 40) : a.room;
  await db.$transaction(async (tx) => {
    await tx.appointment.update({
      where: { id },
      data: { status: to, room, ...(to === "CONFIRMED" && { confirmedAt: new Date(), confirmChannel: "staff" }) },
    });
    await log(tx, actor, a, to === "CANCELLED" ? "cancelled" : "status", { fromStatus: a.status, toStatus: to, details: { ...(room && to === "READY" && { room }), ...(opts.reason && { reason: text(opts.reason, 200) }) } }, ctx);
  });
  return { ok: true, changed: true };
}

// The calendar's appointments between two instants (staff only; never clinical notes).
export async function listAppointments(actor: Actor, companyId: string, from: Date, to: Date) {
  if (!canEditPatients(actor.level) || !actor.companyIds.includes(companyId)) return null;
  return db.appointment.findMany({
    where: { companyId, startsAt: { lt: to }, endsAt: { gt: from } },
    orderBy: { startsAt: "asc" },
    include: {
      patient: { select: { id: true, number: true, surname: true, firstName: true, flag: true } },
      type: { select: { id: true, labelEl: true, color: true, layer: true } },
      resource: { select: { id: true, label: true, kind: true } },
    },
  });
}

// The status history of one appointment, newest first (side panel).
export async function appointmentHistory(actor: Actor, id: string) {
  const a = await own(actor, id);
  if (!a || !canEditPatients(actor.level)) return null;
  return db.appointmentEvent.findMany({ where: { appointmentId: id }, orderBy: { at: "desc" }, take: 30 });
}

// ── Calendar ↔ visits (Phase 6a-4) ───────────────────────────────────────────────
// "Έναρξη επίσκεψης": the patient goes to "with the doctor" (via "arrived" if they were
// not checked in) and the new visit opens.
export async function startVisit(actor: Actor, id: string, ctx: RequestContext): Promise<Fail | { ok: true; patientId: string | null }> {
  const a = await own(actor, id);
  if (!a) return fail("not_found");
  if (a.status === "BOOKED" || a.status === "CONFIRMED") {
    const r = await setAppointmentStatus(actor, id, "ARRIVED", {}, ctx);
    if (!r.ok) return r;
  }
  const r = await setAppointmentStatus(actor, id, "WITH_DOCTOR", {}, ctx);
  if (!r.ok) return r;
  return { ok: true, patientId: a.patientId };
}

// The visit was saved from this appointment: link them; "to pay" if the visit has a fee,
// otherwise straight to "done" (SPEC §4c).
export async function linkVisit(actor: Actor, id: string, visitId: string, ctx: RequestContext): Promise<Fail | { ok: true }> {
  const a = await own(actor, id);
  const v = await db.visit.findFirst({ where: { id: visitId, companyId: { in: actor.companyIds } }, select: { patientId: true, companyId: true, feeCents: true } });
  if (!a || !v || v.patientId !== a.patientId || v.companyId !== a.companyId) return fail("not_found");
  await db.appointment.update({ where: { id }, data: { visitId } });
  if (a.status === "WITH_DOCTOR") return setAppointmentStatus(actor, id, v.feeCents ? "TO_PAY" : "DONE", {}, ctx).then((r) => (r.ok ? { ok: true as const } : r));
  return { ok: true };
}

// The front desk closed the visit after payment: its appointment is done.
export async function visitClosed(actor: Actor, visitId: string, ctx: RequestContext) {
  const appts = await db.appointment.findMany({ where: { visitId, status: "TO_PAY", companyId: { in: actor.companyIds } }, select: { id: true } });
  for (const a of appts) await setAppointmentStatus(actor, a.id, "DONE", {}, ctx);
}
