"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requestContext, requireSession } from "@/lib/auth/current";
import { saveHistory, unverifyHistory, verifyHistory, type HistoryError } from "@/lib/history/history";
import { loadActor } from "@/lib/users/manage";

async function actorNow() {
  const session = await requireSession();
  return loadActor(session.user.id);
}

export async function saveHistoryAction(patientId: string, json: string): Promise<{ error?: HistoryError | "invalid" }> {
  const actor = await actorNow();
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { error: "invalid" };
  }
  const r = await saveHistory(actor, patientId, raw, await requestContext());
  if (!r.ok) return { error: r.error };
  revalidatePath(`/patients/${patientId}`);
  redirect(`/patients/${patientId}?tab=history`);
}

export async function verifyHistoryAction(patientId: string) {
  const actor = await actorNow();
  await verifyHistory(actor, patientId, await requestContext());
  revalidatePath(`/patients/${patientId}`);
}

export async function unverifyHistoryAction(patientId: string) {
  const actor = await actorNow();
  await unverifyHistory(actor, patientId, await requestContext());
  revalidatePath(`/patients/${patientId}`);
}
