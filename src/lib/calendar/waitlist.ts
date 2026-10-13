import { db } from "@/lib/db";
import { audit, type RequestContext } from "@/lib/audit";
import { canEditPatients, canSeeContactDetails } from "@/lib/permissions";
import { athensParts } from "@/lib/time";
import type { Actor } from "@/lib/users/manage";
import { minutesOf } from "./hours";
import { maskPhone } from "./names";

// Minimal waiting list (6a-8): patient, wanted type, preferred days and times. On a
// cancellation the people it fits are listed with «Κλείσιμο»; WhatsApp offers to several
// at once come with 6d/6e. Entries are never deleted, only taken off (with why).

const hm = /^([01]\d|2[0-3]):([0-5]\d)$/;
const pad = (n: number) => String(n).padStart(2, "0");
const hhmm = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

export type WaitlistRow = {
  id: string;
  patientId: string;
  name: string;
  phone: string | null; // masked
  typeId: string | null;
  type: string | null;
  minutes: number | null;
  days: number[];
  fromTime: string | null;
  toTime: string | null;
  note: string | null;
  since: string; // ISO
};

export async function listWaitlist(actor: Actor, companyId: string): Promise<WaitlistRow[] | null> {
  if (!canEditPatients(actor.level) || !actor.companyIds.includes(companyId)) return null;
  const rows = await db.waitlistEntry.findMany({
    where: { companyId, removedAt: null },
    orderBy: { createdAt: "asc" },
    include: { patient: { select: { firstName: true, surname: true, phones: { where: { isMain: true }, select: { number: true }, take: 1 } } } },
  });
  const types = await db.appointmentType.findMany({ where: { id: { in: rows.flatMap((r) => (r.typeId ? [r.typeId] : [])) } }, select: { id: true, labelEl: true, defaultMinutes: true } });
  const contacts = canSeeContactDetails(actor.level);
  return rows.map((r) => {
    const ty = types.find((x) => x.id === r.typeId);
    return {
      id: r.id, patientId: r.patientId, name: `${r.patient.firstName} ${r.patient.surname}`.trim(),
      phone: contacts ? maskPhone(r.patient.phones[0]?.number ?? null) : null,
      typeId: r.typeId, type: ty?.labelEl ?? null, minutes: ty?.defaultMinutes ?? null,
      days: r.days, fromTime: r.fromTime, toTime: r.toTime, note: r.note, since: r.createdAt.toISOString(),
    };
  });
}

// raw: { patientId, typeId?, days?: number[], fromTime?, toTime?, note? }
export async function addToWaitlist(actor: Actor, companyId: string, raw: Record<string, unknown>, ctx: RequestContext) {
  if (!canEditPatients(actor.level) || !actor.companyIds.includes(companyId)) return { ok: false as const, error: "forbidden" as const };
  const patient = typeof raw.patientId === "string" ? await db.patient.findFirst({ where: { id: raw.patientId, companyId, archivedAt: null }, select: { id: true } }) : null;
  const type = typeof raw.typeId === "string" && raw.typeId ? await db.appointmentType.findFirst({ where: { id: raw.typeId, companyId, isActive: true }, select: { id: true } }) : null;
  const days = Array.isArray(raw.days) ? [...new Set(raw.days.filter((d): d is number => Number.isInteger(d) && d >= 1 && d <= 7))].sort() : [];
  const from = typeof raw.fromTime === "string" && hm.test(raw.fromTime) ? raw.fromTime : null;
  const to = typeof raw.toTime === "string" && hm.test(raw.toTime) ? raw.toTime : null;
  if (!patient || (raw.typeId && !type) || (from && to && minutesOf(from) >= minutesOf(to))) return { ok: false as const, error: "invalid_value" as const };
  const note = typeof raw.note === "string" ? raw.note.replace(/\s+/g, " ").trim().slice(0, 200) || null : null;
  const e = await db.waitlistEntry.create({ data: { companyId, patientId: patient.id, typeId: type?.id ?? null, days, fromTime: from, toTime: to, note, createdById: actor.id } });
  await audit({ action: "waitlist.added", actor, companyId, entityType: "Patient", entityId: patient.id, details: { entryId: e.id, typeId: e.typeId, days, from, to } }, ctx);
  return { ok: true as const, id: e.id };
}

export async function removeFromWaitlist(actor: Actor, id: string, why: string, ctx: RequestContext) {
  if (!canEditPatients(actor.level)) return { ok: false as const, error: "forbidden" as const };
  const e = await db.waitlistEntry.findFirst({ where: { id, companyId: { in: actor.companyIds }, removedAt: null } });
  if (!e) return { ok: false as const, error: "not_found" as const };
  const reason = why.replace(/\s+/g, " ").trim().slice(0, 120) || "removed";
  await db.waitlistEntry.update({ where: { id }, data: { removedAt: new Date(), removedById: actor.id, removedWhy: reason } });
  await audit({ action: "waitlist.removed", actor, companyId: e.companyId, entityType: "Patient", entityId: e.patientId, details: { entryId: id, why: reason } }, ctx);
  return { ok: true as const };
}

export type WaitlistMatch = { id: string; patientId: string; name: string; phone: string | null; typeId: string | null; type: string | null; minutes: number; time: string };

// Who on the list fits a freed time: their day, their time window, and their type's
// length inside it. The person who cancelled is left out.
export async function waitlistMatches(companyId: string, slot: { startsAt: Date; endsAt: Date; start: number; end: number }, excludePatientId: string | null): Promise<WaitlistMatch[]> {
  const weekday = athensParts(slot.startsAt).weekday || 7;
  const rows = await db.waitlistEntry.findMany({
    where: { companyId, removedAt: null, ...(excludePatientId && { NOT: { patientId: excludePatientId } }) },
    orderBy: { createdAt: "asc" },
    include: { patient: { select: { firstName: true, surname: true, phones: { where: { isMain: true }, select: { number: true }, take: 1 } } } },
    take: 200,
  });
  const types = await db.appointmentType.findMany({ where: { id: { in: rows.flatMap((r) => (r.typeId ? [r.typeId] : [])) } }, select: { id: true, labelEl: true, defaultMinutes: true } });
  const out: WaitlistMatch[] = [];
  for (const r of rows) {
    if (r.days.length && !r.days.includes(weekday)) continue;
    const ty = types.find((x) => x.id === r.typeId);
    const minutes = ty?.defaultMinutes ?? slot.end - slot.start;
    const from = Math.max(slot.start, r.fromTime ? minutesOf(r.fromTime) : 0);
    const to = Math.min(slot.end, r.toTime ? minutesOf(r.toTime) : 24 * 60);
    if (to - from < minutes) continue;
    out.push({ id: r.id, patientId: r.patientId, name: `${r.patient.firstName} ${r.patient.surname}`.trim(), phone: maskPhone(r.patient.phones[0]?.number ?? null), typeId: r.typeId, type: ty?.labelEl ?? null, minutes, time: hhmm(from) });
  }
  return out.slice(0, 8);
}
