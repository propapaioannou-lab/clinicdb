import { db } from "@/lib/db";
import { audit, type RequestContext } from "@/lib/audit";
import type { Prisma } from "@/generated/prisma/client";
import { HISTORY_SECTIONS, questionChoices } from "@/lib/history/history";
import type { Actor } from "@/lib/users/manage";
import { canManageSettings } from "./lists";
import { cleanPicks, newKey } from "./picks";

// Settings → Ιατρικό ιστορικό (Phase 2 step 7b, decided 11 Oct 2026): the questionnaire's
// questions and their quick picks, per company. Keys never change (stored answers and the
// high-risk rules use them). Questions and picks are hidden, never deleted, so old
// answers keep their wording.

export type QuestionError = "forbidden" | "not_found" | "invalid_value";
type Result = { ok: true; id?: string } | { ok: false; error: QuestionError };
const fail = (error: QuestionError): Result => ({ ok: false, error });

const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");


export async function listQuestions(companyId: string) {
  const rows = await db.historyQuestion.findMany({ where: { companyId } });
  return rows
    .map((q) => ({ ...q, choices: questionChoices(q.choices) }))
    .sort((a, b) => HISTORY_SECTIONS.indexOf(a.section) - HISTORY_SECTIONS.indexOf(b.section) || a.sortOrder - b.sortOrder);
}

function cleanQuestion(raw: Record<string, unknown>) {
  const labelEl = text(raw.labelEl, 300);
  const section = typeof raw.section === "string" && HISTORY_SECTIONS.includes(raw.section) ? raw.section : null;
  if (!labelEl || !section) return null;
  return {
    section,
    labelEl,
    labelEn: text(raw.labelEn, 300) || labelEl,
    detailEl: text(raw.detailEl, 200) || null,
    detailEn: text(raw.detailEn, 200) || null,
    hintEl: text(raw.hintEl, 200) || null,
    hintEn: text(raw.hintEn, 200) || null,
    sensitive: raw.sensitive === true,
    infection: raw.infection === true,
    isActive: raw.isActive !== false,
  };
}

async function own(actor: Actor, id: string) {
  return db.historyQuestion.findFirst({ where: { id, companyId: { in: actor.companyIds } } });
}

export async function addQuestion(actor: Actor, companyId: string, raw: Record<string, unknown>, ctx: RequestContext): Promise<Result> {
  if (!canManageSettings(actor)) return fail("forbidden");
  if (!actor.companyIds.includes(companyId)) return fail("not_found");
  const q = cleanQuestion(raw);
  if (!q) return fail("invalid_value");
  const last = await db.historyQuestion.aggregate({ where: { companyId, section: q.section }, _max: { sortOrder: true } });
  const created = await db.historyQuestion.create({
    data: { ...q, companyId, key: newKey("q_"), sortOrder: (last._max.sortOrder ?? -1) + 1, choices: cleanPicks(raw.choices ?? [], [], "c_") as unknown as Prisma.InputJsonValue },
  });
  await audit({ action: "settings.question.added", actor, companyId, entityType: "HistoryQuestion", entityId: created.id, details: { key: created.key, label: q.labelEl } }, ctx);
  return { ok: true, id: created.id };
}

export async function updateQuestion(actor: Actor, id: string, raw: Record<string, unknown>, ctx: RequestContext): Promise<Result> {
  if (!canManageSettings(actor)) return fail("forbidden");
  const before = await own(actor, id);
  if (!before) return fail("not_found");
  const q = cleanQuestion(raw);
  const choices = cleanPicks(raw.choices ?? [], questionChoices(before.choices), "c_");
  if (!q || !choices) return fail("invalid_value");
  // A question moved to another section goes to the end of it.
  const sortOrder =
    q.section === before.section
      ? before.sortOrder
      : ((await db.historyQuestion.aggregate({ where: { companyId: before.companyId, section: q.section }, _max: { sortOrder: true } }))._max.sortOrder ?? -1) + 1;
  const data = { ...q, sortOrder, choices: choices as unknown as Prisma.InputJsonValue };
  const changed: string[] = (Object.keys(q) as (keyof typeof q)[]).filter((k) => before[k] !== q[k]);
  if (JSON.stringify(questionChoices(before.choices)) !== JSON.stringify(choices)) changed.push("choices");
  if (!changed.length) return { ok: true };
  await db.historyQuestion.update({ where: { id }, data });
  await audit({ action: "settings.question.updated", actor, companyId: before.companyId, entityType: "HistoryQuestion", entityId: id, details: { key: before.key, changed } }, ctx);
  return { ok: true };
}

// Up / down within its section; the section is renumbered 0, 1, 2…
export async function moveQuestion(actor: Actor, id: string, step: -1 | 1, ctx: RequestContext): Promise<Result> {
  if (!canManageSettings(actor)) return fail("forbidden");
  const q = await own(actor, id);
  if (!q) return fail("not_found");
  const list = await db.historyQuestion.findMany({ where: { companyId: q.companyId, section: q.section }, orderBy: { sortOrder: "asc" } });
  const i = list.findIndex((x) => x.id === id);
  const j = i + step;
  if (j < 0 || j >= list.length) return { ok: true };
  [list[i], list[j]] = [list[j], list[i]];
  await db.$transaction(list.map((x, n) => db.historyQuestion.update({ where: { id: x.id }, data: { sortOrder: n } })));
  await audit({ action: "settings.question.moved", actor, companyId: q.companyId, entityType: "HistoryQuestion", entityId: id, details: { key: q.key, position: j + 1 } }, ctx);
  return { ok: true };
}
