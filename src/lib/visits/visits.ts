import { db } from "@/lib/db";
import { audit, type RequestContext } from "@/lib/audit";
import type { Prisma } from "@/generated/prisma/client";
import { canCloseVisit, canEditPatients, canHandleMoney, canReopenVisit } from "@/lib/permissions";
import type { Actor } from "@/lib/users/manage";
import { EXAM_AREA_KEYS, findProcedure } from "./catalog";
import { breastSummary, cleanBreastExam, type BreastExam } from "./exams/breast";
import { ageOn } from "@/lib/patients/normalize";
import { athensParts } from "@/lib/time";

// Visits (SPEC §4 Visit). Clinical part: anyone who may edit patients. Charge part:
// Secretary or PA/nurse only, and never returned to anyone else.

// text = free notes; exam = structured findings (breast so far); summary = the findings
// written as sentences when the visit was saved (kept as recorded, for memos/certificates).
export type VisitArea = { area: string; text: string; exam?: BreastExam; summary?: string };
export type VisitProcedure = { key: string; subs: string[] };

export type VisitInput = {
  typeId: string | null;
  // Missing: "now" for a new visit, unchanged when editing.
  startedAt: Date | null;
  general: string | null;
  areas: VisitArea[];
  procedures: VisitProcedure[];
  diagnosis: string | null;
  weightKg: number | null;
  heightCm: number | null;
};

export type ChargeInput = { feeCents: number | null; paidCents: number | null; paymentMethod: string | null };

export type VisitError = "forbidden" | "not_found" | "closed" | "invalid_type" | "invalid_value";
type Fail = { ok: false; error: VisitError };
const fail = (error: VisitError): Fail => ({ ok: false, error });

export const PAYMENT_METHODS = ["cash", "card", "transfer"] as const;

const text = (v: unknown, max = 10000) => {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, max);
  return t || null;
};
const num = (v: unknown, min: number, max: number, decimals = 0) => {
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : v;
  if (v === null || v === undefined || v === "" || typeof n !== "number" || !Number.isFinite(n)) return null;
  if (n < min || n > max) return undefined; // out of range: an error, not silently dropped
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
};

// Everything from the browser is rebuilt: unknown areas/procedures/sub-options dropped,
// texts trimmed, measurements checked against sensible ranges.
export function cleanVisitInput(raw: Record<string, unknown>): VisitInput | "invalid_value" {
  const areas: VisitArea[] = [];
  for (const a of Array.isArray(raw.areas) ? raw.areas : []) {
    const area = (a as Record<string, unknown>)?.area;
    if (typeof area !== "string" || !EXAM_AREA_KEYS.has(area) || areas.some((x) => x.area === area)) continue;
    const entry: VisitArea = { area, text: text((a as Record<string, unknown>).text) ?? "" };
    if (area === "breast") {
      const exam = cleanBreastExam((a as Record<string, unknown>).exam);
      if (exam) entry.exam = exam;
    }
    areas.push(entry);
  }
  const procedures: VisitProcedure[] = [];
  for (const pr of Array.isArray(raw.procedures) ? raw.procedures : []) {
    const key = (pr as Record<string, unknown>)?.key;
    const def = typeof key === "string" ? findProcedure(key) : undefined;
    if (!def || procedures.some((x) => x.key === key)) continue;
    const allowed = new Set((def.subs ?? []).map((s) => s.key));
    const subs = Array.isArray((pr as Record<string, unknown>).subs) ? ((pr as Record<string, unknown>).subs as unknown[]) : [];
    procedures.push({ key: def.key, subs: [...new Set(subs.filter((s): s is string => typeof s === "string" && allowed.has(s)))] });
  }
  const weightKg = num(raw.weightKg, 20, 400, 1);
  const heightCm = num(raw.heightCm, 50, 250, 1);
  if (weightKg === undefined || heightCm === undefined) return "invalid_value";
  const startedAt = typeof raw.startedAt === "string" || raw.startedAt instanceof Date ? new Date(raw.startedAt) : null;
  if (startedAt && Number.isNaN(startedAt.getTime())) return "invalid_value";
  return {
    typeId: typeof raw.typeId === "string" && raw.typeId ? raw.typeId : null,
    startedAt,
    general: text(raw.general),
    areas,
    procedures,
    diagnosis: text(raw.diagnosis, 1000),
    weightKg: weightKg ?? null,
    heightCm: heightCm ?? null,
  };
}

async function findPatient(actor: Actor, patientId: string) {
  return db.patient.findFirst({
    where: { id: patientId, companyId: { in: actor.companyIds } },
    select: { id: true, companyId: true, birthDate: true },
  });
}

// Write each structured exam up as sentences, with the patient's age on the visit date.
function withSummaries(areas: VisitArea[], birthDate: Date | null, at: Date): VisitArea[] {
  const age = birthDate ? (ageOn(birthDate, athensParts(at))?.years ?? null) : null;
  return areas.map((a) => (a.area === "breast" && a.exam ? { ...a, summary: breastSummary(a.exam, age) } : a));
}

async function findVisit(actor: Actor, visitId: string) {
  return db.visit.findFirst({ where: { id: visitId, companyId: { in: actor.companyIds } } });
}

async function checkType(companyId: string, typeId: string | null) {
  if (!typeId) return { ok: true as const, type: null };
  const type = await db.listItem.findFirst({ where: { id: typeId, companyId, kind: "VISIT_TYPE" } });
  return type ? { ok: true as const, type } : { ok: false as const };
}

function clinicalData(input: VisitInput) {
  return {
    typeId: input.typeId,
    ...(input.startedAt && { startedAt: input.startedAt }),
    general: input.general,
    areas: input.areas as unknown as Prisma.InputJsonValue,
    procedures: input.procedures as unknown as Prisma.InputJsonValue,
    diagnosis: input.diagnosis,
    weightKg: input.weightKg,
    heightCm: input.heightCm,
  };
}

export async function createVisit(
  actor: Actor,
  patientId: string,
  raw: Record<string, unknown>,
  ctx: RequestContext,
): Promise<Fail | { ok: true; id: string }> {
  if (!canEditPatients(actor.level)) return fail("forbidden");
  const patient = await findPatient(actor, patientId);
  if (!patient) return fail("not_found");
  const input = cleanVisitInput(raw);
  if (input === "invalid_value") return fail("invalid_value");
  const type = await checkType(patient.companyId, input.typeId);
  if (!type.ok) return fail("invalid_type");
  input.areas = withSummaries(input.areas, patient.birthDate, input.startedAt ?? new Date());
  const visit = await db.visit.create({
    data: {
      ...clinicalData(input),
      companyId: patient.companyId,
      patientId,
      doctorId: actor.role === "SURGEON" ? actor.id : null,
      createdById: actor.id,
      // Consultations are charged by default; the secretary sets or changes the amount.
      feeCents: type.type?.chargeable ? (type.type.defaultFeeCents ?? null) : null,
    },
  });
  await audit(
    { action: "visit.created", actor, companyId: patient.companyId, entityType: "Patient", entityId: patientId, details: { visitId: visit.id, typeId: input.typeId } },
    ctx,
  );
  return { ok: true, id: visit.id };
}

export async function updateVisit(actor: Actor, visitId: string, raw: Record<string, unknown>, ctx: RequestContext): Promise<Fail | { ok: true }> {
  if (!canEditPatients(actor.level)) return fail("forbidden");
  const before = await findVisit(actor, visitId);
  if (!before) return fail("not_found");
  if (before.status === "CLOSED") return fail("closed");
  const input = cleanVisitInput(raw);
  if (input === "invalid_value") return fail("invalid_value");
  const type = await checkType(before.companyId, input.typeId);
  if (!type.ok) return fail("invalid_type");
  const p = await db.patient.findUniqueOrThrow({ where: { id: before.patientId }, select: { birthDate: true } });
  input.areas = withSummaries(input.areas, p.birthDate, input.startedAt ?? before.startedAt);
  const data = clinicalData(input);
  await db.visit.update({ where: { id: visitId }, data });
  // Clinical content stays in the visit; the log names what changed.
  const changed = Object.keys(data).filter((k) => {
    const a = before[k as keyof typeof before];
    const b = data[k as keyof typeof data];
    const norm = (v: unknown) => (v instanceof Date ? v.toISOString() : v === null || v === undefined ? null : typeof v === "object" ? JSON.stringify(v) : String(v));
    return norm(a) !== norm(b);
  });
  if (changed.length) {
    await audit(
      { action: "visit.updated", actor, companyId: before.companyId, entityType: "Patient", entityId: before.patientId, details: { visitId, changed } },
      ctx,
    );
  }
  return { ok: true };
}

export async function setVisitCharge(actor: Actor, visitId: string, raw: ChargeInput, ctx: RequestContext): Promise<Fail | { ok: true }> {
  if (!canHandleMoney(actor)) return fail("forbidden");
  const visit = await findVisit(actor, visitId);
  if (!visit) return fail("not_found");
  const cents = (v: number | null) => (v === null ? null : Number.isInteger(v) && v >= 0 && v <= 10_000_000 ? v : undefined);
  const feeCents = cents(raw.feeCents);
  const paidCents = cents(raw.paidCents);
  const method = raw.paymentMethod && (PAYMENT_METHODS as readonly string[]).includes(raw.paymentMethod) ? raw.paymentMethod : null;
  if (feeCents === undefined || paidCents === undefined) return fail("invalid_value");
  await db.visit.update({ where: { id: visitId }, data: { feeCents, paidCents, paymentMethod: paidCents ? method : null } });
  await audit(
    {
      action: "visit.charge_updated",
      actor,
      companyId: visit.companyId,
      entityType: "Patient",
      entityId: visit.patientId,
      details: { visitId, from: { feeCents: visit.feeCents, paidCents: visit.paidCents }, to: { feeCents, paidCents, paymentMethod: method } },
    },
    ctx,
  );
  return { ok: true };
}

export async function setVisitClosed(actor: Actor, visitId: string, closed: boolean, ctx: RequestContext): Promise<Fail | { ok: true }> {
  if (closed ? !canCloseVisit(actor) : !canReopenVisit(actor)) return fail("forbidden");
  const visit = await findVisit(actor, visitId);
  if (!visit) return fail("not_found");
  await db.visit.update({
    where: { id: visitId },
    data: closed ? { status: "CLOSED", closedAt: new Date(), closedById: actor.id } : { status: "OPEN", closedAt: null, closedById: null },
  });
  await audit(
    { action: closed ? "visit.closed" : "visit.reopened", actor, companyId: visit.companyId, entityType: "Patient", entityId: visit.patientId, details: { visitId } },
    ctx,
  );
  return { ok: true };
}

const money = (actor: Actor, v: { feeCents: number | null; paidCents: number | null; paymentMethod: string | null }) =>
  canHandleMoney(actor) ? { feeCents: v.feeCents, paidCents: v.paidCents, paymentMethod: v.paymentMethod } : null;

const dec = (v: Prisma.Decimal | null) => (v === null ? null : Number(v));

// The patient's visits, newest first. Money only for Secretary / PA/nurse.
export async function listVisits(actor: Actor, patientId: string) {
  const patient = await findPatient(actor, patientId);
  if (!patient) return null;
  const visits = await db.visit.findMany({
    where: { patientId },
    orderBy: { startedAt: "desc" },
    include: { type: { select: { label: true } }, doctor: { select: { name: true } } },
  });
  return visits.map((v) => ({
    id: v.id,
    startedAt: v.startedAt,
    type: v.type?.label ?? null,
    doctor: v.doctor?.name ?? null,
    general: v.general,
    diagnosis: v.diagnosis,
    procedures: (v.procedures as VisitProcedure[] | null) ?? [],
    weightKg: dec(v.weightKg),
    status: v.status,
    money: money(actor, v),
  }));
}

export async function moneyTotals(actor: Actor, patientId: string) {
  if (!canHandleMoney(actor)) return null;
  const patient = await findPatient(actor, patientId);
  if (!patient) return null;
  const sums = await db.visit.aggregate({ where: { patientId }, _sum: { feeCents: true, paidCents: true } });
  const fees = sums._sum.feeCents ?? 0;
  const paid = sums._sum.paidCents ?? 0;
  return { fees, paid, balance: fees - paid };
}

// One visit with what the visit screen needs: the previous visit for reference.
export async function getVisit(actor: Actor, visitId: string) {
  const v = await db.visit.findFirst({
    where: { id: visitId, companyId: { in: actor.companyIds } },
    include: { type: { select: { label: true } }, doctor: { select: { name: true } } },
  });
  if (!v) return null;
  const prev = await db.visit.findFirst({
    where: { patientId: v.patientId, startedAt: { lt: v.startedAt } },
    orderBy: { startedAt: "desc" },
    include: { type: { select: { label: true } } },
  });
  return {
    id: v.id,
    patientId: v.patientId,
    companyId: v.companyId,
    typeId: v.typeId,
    type: v.type?.label ?? null,
    doctor: v.doctor?.name ?? null,
    startedAt: v.startedAt,
    general: v.general,
    areas: (v.areas as VisitArea[] | null) ?? [],
    procedures: (v.procedures as VisitProcedure[] | null) ?? [],
    diagnosis: v.diagnosis,
    weightKg: dec(v.weightKg),
    heightCm: dec(v.heightCm),
    status: v.status,
    closedAt: v.closedAt,
    money: money(actor, v),
    previous: prev
      ? { startedAt: prev.startedAt, type: prev.type?.label ?? null, general: prev.general, diagnosis: prev.diagnosis, weightKg: dec(prev.weightKg) }
      : null,
  };
}

// Latest measurements, to pre-fill a new visit (height rarely changes) and for reference.
export async function lastMeasurements(patientId: string) {
  const last = await db.visit.findFirst({
    where: { patientId, OR: [{ weightKg: { not: null } }, { heightCm: { not: null } }] },
    orderBy: { startedAt: "desc" },
    select: { startedAt: true, weightKg: true, heightCm: true },
  });
  return last ? { startedAt: last.startedAt, weightKg: dec(last.weightKg), heightCm: dec(last.heightCm) } : null;
}

// Weight over time for the header chart (oldest first, last 12).
export async function weightSeries(patientId: string) {
  const rows = await db.visit.findMany({
    where: { patientId, weightKg: { not: null } },
    orderBy: { startedAt: "desc" },
    take: 12,
    select: { startedAt: true, weightKg: true },
  });
  return rows.reverse().map((r) => ({ date: r.startedAt, kg: Number(r.weightKg) }));
}
