"use server";

import { revalidatePath } from "next/cache";
import { requestContext, requireSession } from "@/lib/auth/current";
import { addItem, moveItem, renameItem, setItemActive, setVisitFee, type ListError } from "@/lib/settings/lists";
import { loadActor } from "@/lib/users/manage";

export type SettingsState = { error?: ListError; done?: number };

async function run(fn: (actor: Awaited<ReturnType<typeof loadActor>>, ctx: Awaited<ReturnType<typeof requestContext>>) => Promise<{ ok: true } | { ok: false; error: ListError }>, path: string): Promise<SettingsState> {
  const session = await requireSession();
  const actor = await loadActor(session.user.id);
  const r = await fn(actor, await requestContext());
  if (!r.ok) return { error: r.error };
  revalidatePath(path);
  return { done: Date.now() };
}

export async function addListItemAction(companyId: string, kind: string, label: string) {
  return run((a, c) => addItem(a, companyId, kind, label, c), "/settings/lists");
}
export async function renameListItemAction(id: string, label: string) {
  return run((a, c) => renameItem(a, id, label, c), "/settings/lists");
}
export async function moveListItemAction(id: string, step: -1 | 1) {
  return run((a, c) => moveItem(a, id, step === -1 ? -1 : 1, c), "/settings/lists");
}
export async function setListItemActiveAction(id: string, active: boolean) {
  return run((a, c) => setItemActive(a, id, active, c), "/settings/lists");
}
export async function setVisitFeeAction(id: string, chargeable: boolean, fee: string) {
  return run((a, c) => setVisitFee(a, id, chargeable, fee, c), "/settings/fees");
}
