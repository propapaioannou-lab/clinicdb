import { db } from "@/lib/db";
import { audit, type RequestContext } from "@/lib/audit";
import type { ListKind } from "@/generated/prisma/client";
import { canHandleMoney, canManageUsers } from "@/lib/permissions";
import type { Actor } from "@/lib/users/manage";

// Settings → Λίστες (Phase 2 step 7a, decided 11 Oct 2026). Each company has its own
// lists. Items are never deleted (records point to them); hiding removes them from new
// choices only. Admin/Owner edit the lists; visit-type fees are money, so only the
// Secretary or PA/nurse set them (the surgeon never sees fees).

export const EDITABLE_KINDS = ["VISIT_TYPE", "FLAG_REASON", "REFERRAL_SOURCE", "MARITAL_STATUS", "TAX_OFFICE"] as const satisfies readonly ListKind[];
export type EditableKind = (typeof EDITABLE_KINDS)[number];
export const isEditableKind = (k: unknown): k is EditableKind => (EDITABLE_KINDS as readonly unknown[]).includes(k);

export const canManageSettings = (actor: Pick<Actor, "level">) => canManageUsers(actor.level);

export type ListError = "forbidden" | "not_found" | "duplicate" | "invalid_value";
type Result = { ok: true } | { ok: false; error: ListError };
const fail = (error: ListError): Result => ({ ok: false, error });

const label = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, 120) : "");

export async function listItems(companyId: string, kind: EditableKind) {
  return db.listItem.findMany({
    where: { companyId, kind },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    select: { id: true, label: true, isActive: true, chargeable: true, defaultFeeCents: true, sortOrder: true },
  });
}

async function own(actor: Actor, id: string) {
  const item = await db.listItem.findFirst({ where: { id, companyId: { in: actor.companyIds } } });
  return item && isEditableKind(item.kind) ? item : null;
}
const log = (actor: Actor, companyId: string, action: string, details: Record<string, string | number | boolean | null>, ctx: RequestContext) =>
  audit({ action, actor, companyId, entityType: "ListItem", entityId: typeof details.id === "string" ? details.id : undefined, details }, ctx);

const taken = (companyId: string, kind: ListKind, name: string, exceptId?: string) =>
  db.listItem.findFirst({ where: { companyId, kind, label: { equals: name, mode: "insensitive" }, ...(exceptId && { NOT: { id: exceptId } }) } });

export async function addItem(actor: Actor, companyId: string, kind: unknown, raw: unknown, ctx: RequestContext): Promise<Result> {
  if (!canManageSettings(actor)) return fail("forbidden");
  if (!actor.companyIds.includes(companyId) || !isEditableKind(kind)) return fail("not_found");
  const name = label(raw);
  if (!name) return fail("invalid_value");
  if (await taken(companyId, kind, name)) return fail("duplicate");
  const last = await db.listItem.aggregate({ where: { companyId, kind }, _max: { sortOrder: true } });
  const item = await db.listItem.create({ data: { companyId, kind, label: name, sortOrder: (last._max.sortOrder ?? -1) + 1 } });
  await log(actor, companyId, "settings.list.added", { id: item.id, kind, label: name }, ctx);
  return { ok: true };
}

export async function renameItem(actor: Actor, id: string, raw: unknown, ctx: RequestContext): Promise<Result> {
  if (!canManageSettings(actor)) return fail("forbidden");
  const item = await own(actor, id);
  if (!item) return fail("not_found");
  const name = label(raw);
  if (!name) return fail("invalid_value");
  if (name === item.label) return { ok: true };
  if (await taken(item.companyId, item.kind, name, id)) return fail("duplicate");
  await db.listItem.update({ where: { id }, data: { label: name } });
  // Records point to the item, so they show the new name too.
  await log(actor, item.companyId, "settings.list.renamed", { id, kind: item.kind, from: item.label, to: name }, ctx);
  return { ok: true };
}

// One step up or down; the list is renumbered 0, 1, 2… so the order is always clean.
export async function moveItem(actor: Actor, id: string, step: -1 | 1, ctx: RequestContext): Promise<Result> {
  if (!canManageSettings(actor)) return fail("forbidden");
  const item = await own(actor, id);
  if (!item) return fail("not_found");
  const list = await listItems(item.companyId, item.kind as EditableKind);
  const i = list.findIndex((x) => x.id === id);
  const j = i + step;
  if (j < 0 || j >= list.length) return { ok: true };
  [list[i], list[j]] = [list[j], list[i]];
  await db.$transaction(list.map((x, n) => db.listItem.update({ where: { id: x.id }, data: { sortOrder: n } })));
  await log(actor, item.companyId, "settings.list.moved", { id, kind: item.kind, position: j + 1 }, ctx);
  return { ok: true };
}

export async function setItemActive(actor: Actor, id: string, active: boolean, ctx: RequestContext): Promise<Result> {
  if (!canManageSettings(actor)) return fail("forbidden");
  const item = await own(actor, id);
  if (!item) return fail("not_found");
  if (item.isActive === active) return { ok: true };
  await db.listItem.update({ where: { id }, data: { isActive: active } });
  await log(actor, item.companyId, active ? "settings.list.shown" : "settings.list.hidden", { id, kind: item.kind, label: item.label }, ctx);
  return { ok: true };
}

// Visit types only: charged by default, and the amount (in cents). Money roles only.
export async function setVisitFee(actor: Actor, id: string, chargeable: boolean, feeRaw: unknown, ctx: RequestContext): Promise<Result> {
  if (!canHandleMoney(actor)) return fail("forbidden");
  const item = await own(actor, id);
  if (!item || item.kind !== "VISIT_TYPE") return fail("not_found");
  const text = typeof feeRaw === "string" ? feeRaw.replace(",", ".").trim() : feeRaw;
  const euros = text === "" || text === null || text === undefined ? null : Number(text);
  if (euros !== null && (!Number.isFinite(euros) || euros < 0 || euros > 100000)) return fail("invalid_value");
  if (chargeable && euros === null) return fail("invalid_value");
  const feeCents = euros === null ? null : Math.round(euros * 100);
  await db.listItem.update({ where: { id }, data: { chargeable, defaultFeeCents: feeCents } });
  await log(actor, item.companyId, "settings.fee.changed", { id, label: item.label, chargeable, feeCents }, ctx);
  return { ok: true };
}
