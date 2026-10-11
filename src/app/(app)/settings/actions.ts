"use server";

import { revalidatePath } from "next/cache";
import { requestContext, requireSession } from "@/lib/auth/current";
import { addQuestion, moveQuestion, updateQuestion, type QuestionError } from "@/lib/settings/history-questions";
import { addItem, moveItem, renameItem, setItemActive, setVisitFee, type ListError } from "@/lib/settings/lists";
import { loadActor } from "@/lib/users/manage";

export type SettingsState = { error?: ListError; done?: number };
export type QuestionState = { error?: QuestionError; done?: number };

async function run<E extends string>(
  fn: (actor: Awaited<ReturnType<typeof loadActor>>, ctx: Awaited<ReturnType<typeof requestContext>>) => Promise<{ ok: true } | { ok: false; error: E }>,
  path: string,
): Promise<{ error?: E; done?: number }> {
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

export async function addQuestionAction(companyId: string, v: Record<string, unknown>) {
  return run((a, c) => addQuestion(a, companyId, v, c), "/settings/history");
}
export async function updateQuestionAction(id: string, v: Record<string, unknown>) {
  return run((a, c) => updateQuestion(a, id, v, c), "/settings/history");
}
export async function moveQuestionAction(id: string, step: -1 | 1) {
  return run((a, c) => moveQuestion(a, id, step === -1 ? -1 : 1, c), "/settings/history");
}
