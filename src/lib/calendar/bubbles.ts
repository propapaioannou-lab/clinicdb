import { db } from "@/lib/db";
import { audit, type RequestContext } from "@/lib/audit";
import { canEditPatients, canSeeContactDetails } from "@/lib/permissions";
import type { Actor } from "@/lib/users/manage";
import { maskPhone, splitName } from "./names";
import { quickBook } from "./quick";

// Patients waiting on the calendar for a time (calendar v3, 14 Oct 2026). Found or added
// in the calendar's search → a bubble at the top of the right-hand column, for everyone
// at the front desk; a click carries it to the grid, a click on a free time books it.
// A new patient is only a name (+ mobile) until booked: quick booking then creates the
// record (tags «προς επιβεβαίωση» …). Bubbles are closed (booked / removed), never deleted.

export type Bubble = {
  id: string;
  patientId: string | null;
  name: string;
  phone: string | null; // masked
  isNew: boolean;
  typeId: string | null;
  type: string | null;
  minutes: number | null;
  color: string | null;
  by: string;
  since: string; // ISO
};

const notify = (companyId: string, action: string, id: string) =>
  db.$executeRaw`SELECT pg_notify('clinic_live', ${JSON.stringify({ type: "bubble", companyId, action, bubbleId: id, at: new Date().toISOString() })})`;

const officeType = (companyId: string, id: string) =>
  db.appointmentType.findFirst({ where: { id, companyId, isActive: true, NOT: { layer: "SURGERY" } } });
const newPatientType = (companyId: string) =>
  db.appointmentType.findFirst({ where: { companyId, isActive: true, forNewPatients: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });

export async function listBubbles(actor: Actor, companyId: string): Promise<Bubble[] | null> {
  if (!canEditPatients(actor.level) || !actor.companyIds.includes(companyId)) return null;
  const rows = await db.calendarBubble.findMany({
    where: { companyId, closedAt: null },
    orderBy: { createdAt: "desc" },
    include: { patient: { select: { firstName: true, surname: true, phones: { where: { isMain: true }, select: { number: true }, take: 1 } } } },
  });
  const types = await db.appointmentType.findMany({ where: { companyId, id: { in: rows.flatMap((r) => (r.typeId ? [r.typeId] : [])) } } });
  const contacts = canSeeContactDetails(actor.level);
  return rows.map((r) => {
    const ty = types.find((x) => x.id === r.typeId);
    return {
      id: r.id,
      patientId: r.patientId,
      name: r.patient ? `${r.patient.firstName} ${r.patient.surname}`.trim() : (r.newName ?? ""),
      phone: contacts ? maskPhone(r.patient ? (r.patient.phones[0]?.number ?? null) : r.newMobile) : null,
      isNew: !r.patientId,
      typeId: ty?.id ?? null,
      type: ty?.labelEl ?? null,
      minutes: ty?.defaultMinutes ?? null,
      color: ty?.color ?? null,
      by: r.createdByName,
      since: r.createdAt.toISOString(),
    };
  });
}

// raw: { patientId, typeId? } for a patient on file, or { newPatient: { name, mobile? } }.
// The same patient waiting twice is one bubble (its type is updated).
export async function addBubble(actor: Actor, companyId: string, raw: Record<string, unknown>, ctx: RequestContext) {
  if (!canEditPatients(actor.level) || !actor.companyIds.includes(companyId)) return { ok: false as const, error: "forbidden" as const };
  const np = raw.newPatient as { name?: unknown; mobile?: unknown } | undefined;
  if (np) {
    const name = typeof np.name === "string" ? np.name.replace(/\s+/g, " ").trim().slice(0, 120) : "";
    const mobile = typeof np.mobile === "string" ? np.mobile.trim().slice(0, 40) : "";
    if (!splitName(name).surname) return { ok: false as const, error: "invalid_value" as const };
    const ty = await newPatientType(companyId);
    const b = await db.calendarBubble.create({ data: { companyId, newName: name, newMobile: mobile || null, typeId: ty?.id ?? null, createdById: actor.id, createdByName: actor.name } });
    await audit({ action: "bubble.created", actor, companyId, entityType: "CalendarBubble", entityId: b.id, details: { newPatient: true } }, ctx);
    await notify(companyId, "created", b.id);
    return { ok: true as const, id: b.id };
  }
  const patient = typeof raw.patientId === "string" ? await db.patient.findFirst({ where: { id: raw.patientId, companyId, archivedAt: null }, select: { id: true } }) : null;
  if (!patient) return { ok: false as const, error: "not_found" as const };
  const ty = typeof raw.typeId === "string" && raw.typeId ? await officeType(companyId, raw.typeId) : null;
  if (raw.typeId && !ty) return { ok: false as const, error: "invalid_value" as const };
  const open = await db.calendarBubble.findFirst({ where: { companyId, patientId: patient.id, closedAt: null } });
  const b = open
    ? await db.calendarBubble.update({ where: { id: open.id }, data: { typeId: ty?.id ?? open.typeId } })
    : await db.calendarBubble.create({ data: { companyId, patientId: patient.id, typeId: ty?.id ?? null, createdById: actor.id, createdByName: actor.name } });
  await audit({ action: open ? "bubble.updated" : "bubble.created", actor, companyId, entityType: "Patient", entityId: patient.id, details: { bubbleId: b.id, typeId: b.typeId } }, ctx);
  await notify(companyId, open ? "updated" : "created", b.id);
  return { ok: true as const, id: b.id };
}

async function openBubble(actor: Actor, id: string) {
  return db.calendarBubble.findFirst({ where: { id, companyId: { in: actor.companyIds }, closedAt: null } });
}

export async function removeBubble(actor: Actor, id: string, ctx: RequestContext) {
  if (!canEditPatients(actor.level)) return { ok: false as const, error: "forbidden" as const };
  const b = await openBubble(actor, id);
  if (!b) return { ok: false as const, error: "not_found" as const };
  await db.calendarBubble.update({ where: { id }, data: { closedAt: new Date(), closedById: actor.id, closedWhy: "removed" } });
  await audit({ action: "bubble.removed", actor, companyId: b.companyId, entityType: b.patientId ? "Patient" : "CalendarBubble", entityId: b.patientId ?? b.id, details: { bubbleId: b.id } }, ctx);
  await notify(b.companyId, "removed", b.id);
  return { ok: true as const };
}

// What the calendar carries while placing a bubble (?bubble=id): its length and label.
export async function bubbleCarry(actor: Actor, id: string) {
  const b = await openBubble(actor, id);
  if (!b) return null;
  const [p, ty] = await Promise.all([
    b.patientId ? db.patient.findFirst({ where: { id: b.patientId, companyId: b.companyId }, select: { firstName: true, surname: true } }) : null,
    b.typeId ? db.appointmentType.findFirst({ where: { id: b.typeId, companyId: b.companyId } }) : b.patientId ? null : newPatientType(b.companyId),
  ]);
  const fallback = ty ?? (await db.appointmentType.findFirst({ where: { companyId: b.companyId, isActive: true, layer: "OFFICE", forNewPatients: false }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }));
  if (!fallback) return null;
  const name = p ? `${p.firstName} ${p.surname}`.trim() : (b.newName ?? "");
  const { firstName, surname } = p ?? splitName(name);
  return {
    id: b.id,
    companyId: b.companyId,
    patientId: b.patientId,
    typeId: fallback.id,
    minutes: fallback.defaultMinutes,
    name,
    who: `${firstName ? `${firstName} ` : ""}${surname.slice(0, 1)}. · ${fallback.labelEl} ${fallback.defaultMinutes}′`,
  };
}

// Put the bubble on a time: a normal quick booking (a new patient's record is created
// then), and the bubble is closed with the appointment it became.
// slot: { resourceId, date, time, flex? }
export async function bookBubble(actor: Actor, id: string, slot: Record<string, unknown>, ctx: RequestContext) {
  const b = await openBubble(actor, id);
  const carry = b && (await bubbleCarry(actor, id));
  if (!b || !carry) return { ok: false as const, error: "not_found" as const };
  const base = { typeId: carry.typeId, resourceId: slot.resourceId, date: slot.date, time: slot.time, flex: slot.flex };
  const r = await quickBook(actor, b.patientId ? { ...base, patientId: b.patientId } : { ...base, newPatient: { name: b.newName ?? "", mobile: b.newMobile ?? "" } }, ctx);
  if (!r.ok) return r;
  const patientId = b.patientId ?? ("patientId" in r ? (r.patientId as string) : null);
  await db.calendarBubble.update({ where: { id }, data: { closedAt: new Date(), closedById: actor.id, closedWhy: "booked", appointmentId: r.id, patientId } });
  await audit({ action: "bubble.booked", actor, companyId: b.companyId, entityType: patientId ? "Patient" : "CalendarBubble", entityId: patientId ?? b.id, details: { bubbleId: b.id, appointmentId: r.id } }, ctx);
  await notify(b.companyId, "booked", b.id);
  return { ...r, patientId };
}
