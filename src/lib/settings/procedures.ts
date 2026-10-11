import { db } from "@/lib/db";
import { audit, type RequestContext } from "@/lib/audit";
import type { Prisma } from "@/generated/prisma/client";
import { PROCEDURE_AREAS } from "@/lib/visits/catalog";
import type { Actor } from "@/lib/users/manage";
import { canManageSettings } from "./lists";
import { cleanPicks, newKey, type Pick } from "./picks";

// Settings → Επεμβάσεις (Phase 2 step 7c, decided 11 Oct 2026): the company's procedure
// catalogue. Names, order, surgical or not, shown or hidden, and sub-options. Keys and
// areas never change (visits, implant specs and the "relevant procedures" rules use them).

export type ProcedureError = "forbidden" | "not_found" | "duplicate" | "invalid_value";
type Result = { ok: true; id?: string } | { ok: false; error: ProcedureError };
const fail = (error: ProcedureError): Result => ({ ok: false, error });
const AREAS = PROCEDURE_AREAS.map((a) => a.key);

const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const picks = (raw: unknown): Pick[] => (Array.isArray(raw) ? (raw as Pick[]) : []);

export async function listProcedures(companyId: string) {
  const rows = await db.catalogProcedure.findMany({ where: { companyId }, orderBy: [{ sortOrder: "asc" }, { labelEl: "asc" }] });
  return rows.map((r) => ({ ...r, subs: picks(r.subs) }));
}

async function own(actor: Actor, id: string) {
  return db.catalogProcedure.findFirst({ where: { id, companyId: { in: actor.companyIds } } });
}
const taken = (companyId: string, labelEl: string, exceptId?: string) =>
  db.catalogProcedure.findFirst({ where: { companyId, labelEl: { equals: labelEl, mode: "insensitive" }, ...(exceptId && { NOT: { id: exceptId } }) } });

export async function addProcedure(actor: Actor, companyId: string, raw: Record<string, unknown>, ctx: RequestContext): Promise<Result> {
  if (!canManageSettings(actor)) return fail("forbidden");
  if (!actor.companyIds.includes(companyId)) return fail("not_found");
  const area = typeof raw.area === "string" && AREAS.includes(raw.area) ? raw.area : null;
  const labelEl = text(raw.labelEl, 120);
  const subs = cleanPicks(raw.subs ?? [], [], "s_");
  if (!area || !labelEl || !subs) return fail("invalid_value");
  if (await taken(companyId, labelEl)) return fail("duplicate");
  const last = await db.catalogProcedure.aggregate({ where: { companyId, area }, _max: { sortOrder: true } });
  const row = await db.catalogProcedure.create({
    data: {
      companyId, key: newKey("p_"), area, labelEl, labelEn: text(raw.labelEn, 120) || labelEl,
      sortOrder: (last._max.sortOrder ?? -1) + 1, nonSurgical: raw.nonSurgical === true,
      ...(subs.length && { subs: subs as unknown as Prisma.InputJsonValue }),
    },
  });
  await audit({ action: "settings.procedure.added", actor, companyId, entityType: "CatalogProcedure", entityId: row.id, details: { key: row.key, area, label: labelEl } }, ctx);
  return { ok: true, id: row.id };
}

export async function updateProcedure(actor: Actor, id: string, raw: Record<string, unknown>, ctx: RequestContext): Promise<Result> {
  if (!canManageSettings(actor)) return fail("forbidden");
  const before = await own(actor, id);
  if (!before) return fail("not_found");
  const labelEl = text(raw.labelEl, 120);
  const subs = cleanPicks(raw.subs ?? [], picks(before.subs), "s_");
  if (!labelEl || !subs) return fail("invalid_value");
  if (await taken(before.companyId, labelEl, id)) return fail("duplicate");
  const data = { labelEl, labelEn: text(raw.labelEn, 120) || labelEl, nonSurgical: raw.nonSurgical === true, isActive: raw.isActive !== false };
  const changed: string[] = (Object.keys(data) as (keyof typeof data)[]).filter((k) => before[k] !== data[k]);
  if (JSON.stringify(picks(before.subs)) !== JSON.stringify(subs)) changed.push("subs");
  if (!changed.length) return { ok: true };
  await db.catalogProcedure.update({ where: { id }, data: { ...data, subs: subs.length ? (subs as unknown as Prisma.InputJsonValue) : undefined } });
  await audit({ action: "settings.procedure.updated", actor, companyId: before.companyId, entityType: "CatalogProcedure", entityId: id, details: { key: before.key, changed } }, ctx);
  return { ok: true };
}

export async function moveProcedure(actor: Actor, id: string, step: -1 | 1, ctx: RequestContext): Promise<Result> {
  if (!canManageSettings(actor)) return fail("forbidden");
  const pr = await own(actor, id);
  if (!pr) return fail("not_found");
  const list = await db.catalogProcedure.findMany({ where: { companyId: pr.companyId, area: pr.area }, orderBy: [{ sortOrder: "asc" }, { labelEl: "asc" }] });
  const i = list.findIndex((x) => x.id === id);
  const j = i + step;
  if (j < 0 || j >= list.length) return { ok: true };
  [list[i], list[j]] = [list[j], list[i]];
  await db.$transaction(list.map((x, n) => db.catalogProcedure.update({ where: { id: x.id }, data: { sortOrder: n } })));
  await audit({ action: "settings.procedure.moved", actor, companyId: pr.companyId, entityType: "CatalogProcedure", entityId: id, details: { key: pr.key, position: j + 1 } }, ctx);
  return { ok: true };
}
