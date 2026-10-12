import { db } from "@/lib/db";
import { audit, type RequestContext } from "@/lib/audit";
import type { BlockKind, CalendarLayer, Prisma, ResourceKind } from "@/generated/prisma/client";
import { athensSlot } from "@/lib/calendar/appointments";
import { calendarConfigOf } from "@/lib/calendar/config";
import { cleanHours } from "@/lib/calendar/hours";
import { parseDayMonthYear } from "@/lib/patients/normalize";
import { canEditPatients } from "@/lib/permissions";
import type { Actor } from "@/lib/users/manage";
import { canManageSettings } from "./lists";

// Settings → Ημερολόγιο (Phase 6a): appointment types and resources (Admin/Owner);
// blocked time (any staff member). Types and resources are hidden, never deleted.

export const TYPE_COLORS = ["teal", "tealLight", "consult", "recheck", "amber", "purple", "blue", "rose", "grey", "online"] as const;
export const LAYERS: CalendarLayer[] = ["OFFICE", "ONLINE", "SURGERY", "SPA"];
export const RESOURCE_KINDS: ResourceKind[] = ["DOCTOR", "NURSE", "ROOM", "OPERATING_ROOM", "CABIN"];
export const BLOCK_KINDS: BlockKind[] = ["BREAK", "CONGRESS", "LEAVE", "OTHER"];

export type CalendarSettingsError = "forbidden" | "not_found" | "duplicate" | "invalid_value";
type Result = { ok: true; id?: string } | { ok: false; error: CalendarSettingsError };
const fail = (error: CalendarSettingsError): Result => ({ ok: false, error });
const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

const log = (actor: Actor, companyId: string, action: string, entityType: string, entityId: string, details: Prisma.InputJsonValue, ctx: RequestContext) =>
  audit({ action, actor, companyId, entityType, entityId, details }, ctx);

// ── Appointment types ──────────────────────────────────────────────────────────────
function cleanType(raw: Record<string, unknown>) {
  const labelEl = text(raw.labelEl, 80);
  const minutes = Number(raw.defaultMinutes);
  const color = (TYPE_COLORS as readonly string[]).includes(raw.color as string) ? (raw.color as string) : null;
  const layer = LAYERS.includes(raw.layer as CalendarLayer) ? (raw.layer as CalendarLayer) : null;
  if (!labelEl || !color || !layer || !Number.isInteger(minutes) || minutes < 5 || minutes > 720) return null;
  return { labelEl, labelEn: text(raw.labelEn, 80) || labelEl, color, layer, defaultMinutes: minutes, isActive: raw.isActive !== false };
}

export async function saveType(actor: Actor, companyId: string, id: string | null, raw: Record<string, unknown>, ctx: RequestContext): Promise<Result> {
  if (!canManageSettings(actor)) return fail("forbidden");
  if (!actor.companyIds.includes(companyId)) return fail("not_found");
  const v = cleanType(raw);
  if (!v) return fail("invalid_value");
  const same = await db.appointmentType.findFirst({ where: { companyId, labelEl: { equals: v.labelEl, mode: "insensitive" }, ...(id && { NOT: { id } }) } });
  if (same) return fail("duplicate");
  if (id) {
    const before = await db.appointmentType.findFirst({ where: { id, companyId } });
    if (!before) return fail("not_found");
    await db.appointmentType.update({ where: { id }, data: v });
    await log(actor, companyId, "settings.appointmentType.updated", "AppointmentType", id, { changed: (Object.keys(v) as (keyof typeof v)[]).filter((k) => before[k] !== v[k]) }, ctx);
    return { ok: true, id };
  }
  const last = await db.appointmentType.aggregate({ where: { companyId }, _max: { sortOrder: true } });
  const t = await db.appointmentType.create({ data: { ...v, companyId, sortOrder: (last._max.sortOrder ?? -1) + 1 } });
  await log(actor, companyId, "settings.appointmentType.added", "AppointmentType", t.id, { label: v.labelEl }, ctx);
  return { ok: true, id: t.id };
}

// ── Hours rules (calendar v2): surgery window and flex zones ─────────────────────────
// raw: { surgery: HoursRange[], flexBefore: minutes, flexAfter: minutes }. The old and the
// new values are kept in the log.
export async function saveCalendarConfig(actor: Actor, companyId: string, raw: Record<string, unknown>, ctx: RequestContext): Promise<Result> {
  if (!canManageSettings(actor)) return fail("forbidden");
  if (!actor.companyIds.includes(companyId)) return fail("not_found");
  const surgery = cleanHours(raw.surgery ?? []);
  const minutes = (v: unknown) => (Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 120 && v !== "" ? Number(v) : null);
  const flexBefore = minutes(raw.flexBefore);
  const flexAfter = minutes(raw.flexAfter);
  if (!surgery || flexBefore === null || flexAfter === null) return fail("invalid_value");
  const before = await calendarConfigOf(companyId);
  const after = { surgery, flexBefore, flexAfter };
  await db.company.update({ where: { id: companyId }, data: { calendarConfig: after as unknown as Prisma.InputJsonValue } });
  await log(actor, companyId, "settings.calendarHours.updated", "Company", companyId, { before, after } as unknown as Prisma.InputJsonValue, ctx);
  return { ok: true };
}

// ── Resources ──────────────────────────────────────────────────────────────────────
export async function saveResource(actor: Actor, companyId: string, id: string | null, raw: Record<string, unknown>, ctx: RequestContext): Promise<Result> {
  if (!canManageSettings(actor)) return fail("forbidden");
  if (!actor.companyIds.includes(companyId)) return fail("not_found");
  const label = text(raw.label, 80);
  const kind = RESOURCE_KINDS.includes(raw.kind as ResourceKind) ? (raw.kind as ResourceKind) : null;
  const hours = cleanHours(raw.hours ?? []);
  if (!label || !kind || !hours) return fail("invalid_value");
  // A linked user must work in this company.
  const userId = typeof raw.userId === "string" && raw.userId ? raw.userId : null;
  if (userId && !(await db.membership.findFirst({ where: { userId, companyId } }))) return fail("invalid_value");
  const same = await db.resource.findFirst({ where: { companyId, label: { equals: label, mode: "insensitive" }, ...(id && { NOT: { id } }) } });
  if (same) return fail("duplicate");
  const data = { label, kind, userId, hours: hours as unknown as Prisma.InputJsonValue, isActive: raw.isActive !== false };
  if (id) {
    if (!(await db.resource.findFirst({ where: { id, companyId } }))) return fail("not_found");
    await db.resource.update({ where: { id }, data });
    await log(actor, companyId, "settings.resource.updated", "Resource", id, { label, kind }, ctx);
    return { ok: true, id };
  }
  const last = await db.resource.aggregate({ where: { companyId }, _max: { sortOrder: true } });
  const r = await db.resource.create({ data: { ...data, companyId, sortOrder: (last._max.sortOrder ?? -1) + 1 } });
  await log(actor, companyId, "settings.resource.added", "Resource", r.id, { label, kind }, ctx);
  return { ok: true, id: r.id };
}

export async function moveCalendarItem(actor: Actor, what: "type" | "resource", id: string, step: -1 | 1, ctx: RequestContext): Promise<Result> {
  if (!canManageSettings(actor)) return fail("forbidden");
  const table = what === "type" ? db.appointmentType : db.resource;
  const item = await (table as typeof db.resource).findFirst({ where: { id, companyId: { in: actor.companyIds } } });
  if (!item) return fail("not_found");
  const list = await (table as typeof db.resource).findMany({ where: { companyId: item.companyId }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  const i = list.findIndex((x) => x.id === id);
  const j = i + step;
  if (j < 0 || j >= list.length) return { ok: true };
  [list[i], list[j]] = [list[j], list[i]];
  await db.$transaction(list.map((x, n) => (table as typeof db.resource).update({ where: { id: x.id }, data: { sortOrder: n } })));
  await log(actor, item.companyId, `settings.${what}.moved`, what === "type" ? "AppointmentType" : "Resource", id, { position: j + 1 }, ctx);
  return { ok: true };
}

// ── Blocked time ───────────────────────────────────────────────────────────────────
// raw: { resourceId? (empty = everyone), kind, label, fromDate, fromTime, toDate, toTime } (dd/mm/yyyy, HH:MM)
export async function addBlock(actor: Actor, companyId: string, raw: Record<string, unknown>, ctx: RequestContext): Promise<Result> {
  if (!canEditPatients(actor.level)) return fail("forbidden");
  if (!actor.companyIds.includes(companyId)) return fail("not_found");
  const resourceId = typeof raw.resourceId === "string" && raw.resourceId ? raw.resourceId : null;
  if (resourceId && !(await db.resource.findFirst({ where: { id: resourceId, companyId } }))) return fail("not_found");
  const kind = BLOCK_KINDS.includes(raw.kind as BlockKind) ? (raw.kind as BlockKind) : "OTHER";
  // Dates typed as dd/mm/yyyy, like everywhere in the app.
  const iso = (v: unknown) => {
    const d = parseDayMonthYear(typeof v === "string" ? v : null);
    return d instanceof Date ? d.toISOString().slice(0, 10) : null;
  };
  const startsAt = athensSlot(iso(raw.fromDate), raw.fromTime || "00:00");
  const endsAt = athensSlot(iso(raw.toDate), raw.toTime || "23:59");
  if (!startsAt || !endsAt || endsAt <= startsAt || endsAt.getTime() - startsAt.getTime() > 92 * 864e5) return fail("invalid_value");
  const b = await db.calendarBlock.create({ data: { companyId, resourceId, kind, label: text(raw.label, 120) || null, startsAt, endsAt, createdById: actor.id } });
  await log(actor, companyId, "calendar.block.added", "CalendarBlock", b.id, { kind, from: startsAt.toISOString(), to: endsAt.toISOString(), resourceId }, ctx);
  return { ok: true, id: b.id };
}

export async function removeBlock(actor: Actor, id: string, ctx: RequestContext): Promise<Result> {
  if (!canEditPatients(actor.level)) return fail("forbidden");
  const b = await db.calendarBlock.findFirst({ where: { id, companyId: { in: actor.companyIds } } });
  if (!b) return fail("not_found");
  await db.calendarBlock.delete({ where: { id } });
  // The log keeps what was removed.
  await log(actor, b.companyId, "calendar.block.removed", "CalendarBlock", id, { kind: b.kind, label: b.label, from: b.startsAt.toISOString(), to: b.endsAt.toISOString() }, ctx);
  return { ok: true };
}

export async function calendarSettings(companyId: string) {
  const [types, resources, blocks, users] = await Promise.all([
    db.appointmentType.findMany({ where: { companyId }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    db.resource.findMany({ where: { companyId }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    db.calendarBlock.findMany({ where: { companyId, endsAt: { gt: new Date() } }, orderBy: { startsAt: "asc" }, take: 100 }),
    db.user.findMany({ where: { isActive: true, memberships: { some: { companyId } } }, orderBy: { name: "asc" }, select: { id: true, name: true, role: true } }),
  ]);
  return { types, resources, blocks, users };
}
