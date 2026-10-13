"use server";

import { revalidatePath } from "next/cache";
import { requestContext, requireSession } from "@/lib/auth/current";
import { activeCompany } from "@/lib/company";
import { addSuggestion, setSuggestionDone } from "@/lib/demo-suggestions";
import { loadActor } from "@/lib/users/manage";

// «💬 Πρόταση» (online demo): save a comment with the screen it was written on.
export async function addSuggestionAction(input: { screen: string; path: string; text: string }) {
  const session = await requireSession();
  const actor = await loadActor(session.user.id);
  const company = await activeCompany(actor);
  const r = await addSuggestion(actor, company?.id ?? null, input, await requestContext());
  return r.ok ? { ok: true as const } : { error: r.error };
}

export async function setSuggestionDoneAction(id: string, done: boolean) {
  const session = await requireSession();
  const actor = await loadActor(session.user.id);
  const r = await setSuggestionDone(actor, id, done, await requestContext());
  revalidatePath("/suggestions");
  return r.ok ? { ok: true as const } : { error: r.error };
}
