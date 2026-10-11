import { db } from "@/lib/db";
import { audit, type RequestContext } from "@/lib/audit";
import type { HistorySource, Prisma } from "@/generated/prisma/client";
import { canEditPatients, canSeeSensitiveHistory } from "@/lib/permissions";
import type { Actor } from "@/lib/users/manage";
import { changedParts, cleanHistory, type HistoryData } from "./data";
import { riskFactors } from "./risk";

// Medical history (SPEC §4): every save is a new version; a Surgeon or PA/nurse verifies.

// hidden: no longer offered (Settings), kept so old answers keep their wording.
export type QuestionChoice = { key: string; labelEl: string; labelEn: string; hidden?: boolean };

// The quick picks stored with a question (JSON), checked for shape.
export function questionChoices(raw: unknown): QuestionChoice[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (c): c is QuestionChoice => !!c && typeof c === "object" && typeof c.key === "string" && typeof c.labelEl === "string" && typeof c.labelEn === "string",
  );
}

export const HISTORY_SECTIONS = ["heart", "lungs", "blood", "gi", "neuro", "endocrine", "infections", "habits", "healing", "gyn", "family"];

export type HistoryError = "forbidden" | "not_found" | "not_verifier" | "nothing_to_verify";
type Fail = { ok: false; error: HistoryError };
const fail = (error: HistoryError): Fail => ({ ok: false, error });

// Only physicians and PA/nurses may verify (SPEC §4, §11).
export function canVerifyHistory(actor: Pick<Actor, "level" | "role">) {
  return canEditPatients(actor.level) && (actor.role === "SURGEON" || actor.role === "PA_NURSE");
}

async function findPatient(actor: Actor, patientId: string) {
  return db.patient.findFirst({
    where: { id: patientId, companyId: { in: actor.companyIds } },
    select: { id: true, companyId: true, infectiousDiseases: true },
  });
}

export async function historyQuestions(companyId: string, opts: { includeSensitive: boolean }) {
  return db.historyQuestion.findMany({
    where: { companyId, isActive: true, ...(!opts.includeSensitive && { sensitive: false }) },
    orderBy: [{ sortOrder: "asc" }],
  });
}

// Everything the history tab and widget need. Sensitive questions and their answers
// (HIV, hepatitis, substance use, mental health) only for Surgeon, PA/nurse, Secretary.
export async function loadHistory(actor: Actor, patientId: string) {
  const patient = await findPatient(actor, patientId);
  if (!patient) return null;
  const includeSensitive = canSeeSensitiveHistory(actor);
  const [questions, history, versions] = await Promise.all([
    historyQuestions(patient.companyId, { includeSensitive }),
    db.patientHistory.findUnique({ where: { patientId }, include: { currentVersion: true } }),
    db.patientHistoryVersion.findMany({
      where: { patientId },
      orderBy: { number: "desc" },
      select: { id: true, number: true, source: true, createdByName: true, createdAt: true },
    }),
  ]);
  let data = history ? (history.currentVersion.data as HistoryData) : null;
  if (data && !includeSensitive) {
    const allowed = new Set(questions.map((q) => q.key));
    data = { ...data, answers: Object.fromEntries(Object.entries(data.answers).filter(([k]) => allowed.has(k))) };
  }
  return {
    companyId: patient.companyId,
    questions,
    data,
    status: history?.status ?? null,
    verifiedAt: history?.verifiedAt ?? null,
    verifiedByName: history?.verifiedByName ?? null,
    verifiedRole: history?.verifiedRole ?? null,
    current: history
      ? {
          number: history.currentVersion.number,
          source: history.currentVersion.source,
          createdByName: history.currentVersion.createdByName,
          createdAt: history.currentVersion.createdAt,
        }
      : null,
    versions,
  };
}

// The infectious-disease alert on the patient header follows the verified answers:
// any Yes → listed; all answered No → cleared; nothing answered → left as it was.
export function infectionAlert(questions: { key: string; labelEl: string; infection: boolean }[], data: HistoryData): string | null | undefined {
  const infections = questions.filter((q) => q.infection);
  const yes = infections.filter((q) => data.answers[q.key]?.a === "yes");
  if (yes.length) return yes.map((q) => (data.answers[q.key].d ? `${q.labelEl} (${data.answers[q.key].d})` : q.labelEl)).join(", ");
  if (infections.length && infections.every((q) => data.answers[q.key]?.a === "no")) return null;
  return undefined;
}

async function applyInfectionAlert(tx: Prisma.TransactionClient, patientId: string, companyId: string, data: HistoryData) {
  const questions = await tx.historyQuestion.findMany({ where: { companyId, infection: true }, select: { key: true, labelEl: true, infection: true } });
  const alert = infectionAlert(questions, data);
  if (alert !== undefined) await tx.patient.update({ where: { id: patientId }, data: { infectiousDiseases: alert } });
}

// Save a new version. Entered by a Surgeon or PA/nurse it counts as verified; by anyone
// else (or the patient, later) it waits for verification.
export async function saveHistory(
  actor: Actor,
  patientId: string,
  raw: unknown,
  ctx: RequestContext,
  source: HistorySource = "STAFF",
): Promise<Fail | { ok: true; number: number; verified: boolean }> {
  if (!canEditPatients(actor.level)) return fail("forbidden");
  const patient = await findPatient(actor, patientId);
  if (!patient) return fail("not_found");
  // Every question, hidden ones too, so their stored picks stay valid.
  const questions = await db.historyQuestion.findMany({ where: { companyId: patient.companyId } });
  const data = cleanHistory(raw, new Map(questions.map((q) => [q.key, questionChoices(q.choices).map((c) => c.key)])));
  // Answers this person could not see (sensitive) or that the form no longer shows (hidden
  // question) are carried over unchanged from the current version: never lost, never
  // changed by someone who did not see them.
  const seeSensitive = canSeeSensitiveHistory(actor);
  const carried = questions.filter((q) => !q.isActive || (q.sensitive && !seeSensitive)).map((q) => q.key);
  if (carried.length) {
    const current = await db.patientHistory.findUnique({ where: { patientId }, include: { currentVersion: true } });
    const before = (current?.currentVersion.data as HistoryData | undefined)?.answers ?? {};
    for (const k of carried) {
      if (before[k]) data.answers[k] = before[k];
      else delete data.answers[k];
    }
  }
  const verified = source === "STAFF" && canVerifyHistory(actor);
  const now = new Date();

  const result = await db.$transaction(async (tx) => {
    const prev = await tx.patientHistory.findUnique({ where: { patientId }, include: { currentVersion: true } });
    const last = await tx.patientHistoryVersion.aggregate({ where: { patientId }, _max: { number: true } });
    const number = (last._max.number ?? 0) + 1;
    const version = await tx.patientHistoryVersion.create({
      data: {
        patientId,
        companyId: patient.companyId,
        number,
        source,
        createdById: actor.id,
        createdByName: actor.name,
        data: data as Prisma.InputJsonValue,
      },
    });
    const status = verified
      ? { status: "VERIFIED" as const, verifiedAt: now, verifiedById: actor.id, verifiedByName: actor.name, verifiedRole: actor.role }
      : { status: "PENDING" as const, verifiedAt: null, verifiedById: null, verifiedByName: null, verifiedRole: null };
    await tx.patientHistory.upsert({
      where: { patientId },
      create: { patientId, companyId: patient.companyId, currentVersionId: version.id, ...status },
      update: { currentVersionId: version.id, ...status },
    });
    if (verified) await applyInfectionAlert(tx, patientId, patient.companyId, data);
    // The high-risk profile follows the latest answers at once, verified or not: safety first.
    await tx.patient.update({ where: { id: patientId }, data: { riskFactors: riskFactors(data) } });
    return { number, changed: changedParts(prev ? (prev.currentVersion.data as HistoryData) : null, data) };
  });

  await audit(
    {
      action: "history.saved",
      actor,
      companyId: patient.companyId,
      entityType: "Patient",
      entityId: patientId,
      details: { version: result.number, source, verified, changed: result.changed },
    },
    ctx,
  );
  return { ok: true, number: result.number, verified };
}

export async function verifyHistory(actor: Actor, patientId: string, ctx: RequestContext): Promise<Fail | { ok: true }> {
  if (!canVerifyHistory(actor)) return fail("not_verifier");
  const patient = await findPatient(actor, patientId);
  if (!patient) return fail("not_found");
  const history = await db.patientHistory.findUnique({ where: { patientId }, include: { currentVersion: true } });
  if (!history || history.status === "VERIFIED") return fail("nothing_to_verify");
  await db.$transaction(async (tx) => {
    await tx.patientHistory.update({
      where: { patientId },
      data: { status: "VERIFIED", verifiedAt: new Date(), verifiedById: actor.id, verifiedByName: actor.name, verifiedRole: actor.role },
    });
    await applyInfectionAlert(tx, patientId, patient.companyId, history.currentVersion.data as HistoryData);
  });
  await audit(
    {
      action: "history.verified",
      actor,
      companyId: patient.companyId,
      entityType: "Patient",
      entityId: patientId,
      details: { version: history.currentVersion.number },
    },
    ctx,
  );
  return { ok: true };
}

// "Αναίρεση" next to the verified pill: back to pending.
export async function unverifyHistory(actor: Actor, patientId: string, ctx: RequestContext): Promise<Fail | { ok: true }> {
  if (!canVerifyHistory(actor)) return fail("not_verifier");
  const patient = await findPatient(actor, patientId);
  if (!patient) return fail("not_found");
  const history = await db.patientHistory.findUnique({ where: { patientId }, include: { currentVersion: true } });
  if (!history || history.status !== "VERIFIED") return fail("nothing_to_verify");
  await db.patientHistory.update({
    where: { patientId },
    data: { status: "PENDING", verifiedAt: null, verifiedById: null, verifiedByName: null, verifiedRole: null },
  });
  await audit(
    {
      action: "history.unverified",
      actor,
      companyId: patient.companyId,
      entityType: "Patient",
      entityId: patientId,
      details: { version: history.currentVersion.number },
    },
    ctx,
  );
  return { ok: true };
}

// One earlier version, e.g. to see what the patient originally answered.
export async function loadHistoryVersion(actor: Actor, patientId: string, number: number) {
  const patient = await findPatient(actor, patientId);
  if (!patient) return null;
  const v = await db.patientHistoryVersion.findUnique({ where: { patientId_number: { patientId, number } } });
  if (!v) return null;
  let data = v.data as HistoryData;
  if (!canSeeSensitiveHistory(actor)) {
    const allowed = new Set((await historyQuestions(patient.companyId, { includeSensitive: false })).map((q) => q.key));
    data = { ...data, answers: Object.fromEntries(Object.entries(data.answers).filter(([k]) => allowed.has(k))) };
  }
  return { number: v.number, source: v.source, createdByName: v.createdByName, createdAt: v.createdAt, data };
}
