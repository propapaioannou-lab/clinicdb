"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requestContext, requireSession } from "@/lib/auth/current";
import { athensDateTime } from "@/lib/time";
import { loadActor } from "@/lib/users/manage";
import { createVisit, setVisitCharge, setVisitClosed, updateVisit, type VisitError } from "@/lib/visits/visits";

export type VisitActionState = { error?: VisitError | "invalid_date" | "invalid"; saved?: boolean };

async function actorNow() {
  const session = await requireSession();
  return loadActor(session.user.id);
}

// The form sends JSON; date and time arrive as Athens "dd/mm/yyyy" + "HH:MM".
function parse(json: string): Record<string, unknown> | "invalid" | "invalid_date" {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(json);
  } catch {
    return "invalid";
  }
  const date = typeof raw.date === "string" ? raw.date : "";
  const time = typeof raw.time === "string" ? raw.time : "";
  const startedAt = athensDateTime(date, time);
  if (!startedAt) return "invalid_date";
  return { ...raw, startedAt };
}

export async function createVisitAction(patientId: string, json: string): Promise<VisitActionState> {
  const actor = await actorNow();
  const raw = parse(json);
  if (typeof raw === "string") return { error: raw };
  const r = await createVisit(actor, patientId, raw, await requestContext());
  if (!r.ok) return { error: r.error };
  revalidatePath(`/patients/${patientId}`);
  // Back to the patient's visits (decided 11 Oct 2026).
  redirect(`/patients/${patientId}?tab=visits&saved=1`);
}

export async function updateVisitAction(patientId: string, visitId: string, json: string): Promise<VisitActionState> {
  const actor = await actorNow();
  const raw = parse(json);
  if (typeof raw === "string") return { error: raw };
  const r = await updateVisit(actor, visitId, raw, await requestContext());
  if (!r.ok) return { error: r.error };
  revalidatePath(`/patients/${patientId}`);
  revalidatePath(`/patients/${patientId}/visits/${visitId}`);
  redirect(`/patients/${patientId}?tab=visits&saved=1`);
}

// Amounts arrive in euros ("70" or "70,50") and are stored in cents.
export async function setChargeAction(patientId: string, visitId: string, fd: FormData): Promise<VisitActionState> {
  const actor = await actorNow();
  const cents = (v: FormDataEntryValue | null) => {
    const s = String(v ?? "").trim().replace(",", ".");
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? Math.round(n * 100) : NaN;
  };
  const feeCents = cents(fd.get("fee"));
  const paidCents = cents(fd.get("paid"));
  if (Number.isNaN(feeCents) || Number.isNaN(paidCents)) return { error: "invalid_value" };
  const r = await setVisitCharge(actor, visitId, { feeCents, paidCents, paymentMethod: String(fd.get("method") ?? "") || null }, await requestContext());
  if (!r.ok) return { error: r.error };
  revalidatePath(`/patients/${patientId}`);
  revalidatePath(`/patients/${patientId}/visits/${visitId}`);
  return { saved: true };
}

// "Αποθήκευση & κλείσιμο": the front desk records the payment and closes the visit.
export async function chargeAndCloseAction(patientId: string, visitId: string, fd: FormData): Promise<VisitActionState> {
  const r = await setChargeAction(patientId, visitId, fd);
  if (r.error) return r;
  const actor = await actorNow();
  const closed = await setVisitClosed(actor, visitId, true, await requestContext());
  if (!closed.ok) return { error: closed.error };
  revalidatePath(`/patients/${patientId}`);
  redirect(`/patients/${patientId}?tab=visits&saved=1`);
}

export async function setClosedAction(patientId: string, visitId: string, closed: boolean) {
  const actor = await actorNow();
  await setVisitClosed(actor, visitId, closed, await requestContext());
  revalidatePath(`/patients/${patientId}`);
  revalidatePath(`/patients/${patientId}/visits/${visitId}`);
}
