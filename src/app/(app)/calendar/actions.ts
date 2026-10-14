"use server";

import { revalidatePath } from "next/cache";
import type { AppointmentStatus } from "@/generated/prisma/client";
import { requestContext, requireSession } from "@/lib/auth/current";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { appointmentHistory, createAppointment, moveAppointment, NEEDS_REASON, setAppointmentStatus, setMoveNotify, startVisit, undoMove, type CalendarError, type Problem } from "@/lib/calendar/appointments";
import { arrive, bookingSearch, quickBook, quickDuplicates } from "@/lib/calendar/quick";
import { cancelAppointment, cancelPreview, type CancelKind } from "@/lib/calendar/cancel";
import { CANCEL_STATUSES, STATUS_LABEL } from "@/lib/calendar/status";
import { addToWaitlist, removeFromWaitlist, type WaitlistMatch } from "@/lib/calendar/waitlist";
import { addBubble, bookBubble, removeBubble } from "@/lib/calendar/bubbles";
import { db } from "@/lib/db";
import { activeCompany } from "@/lib/company";
import { parseDayMonthYear } from "@/lib/patients/normalize";
import { athensIsoDate, athensParts } from "@/lib/time";
import { loadActor } from "@/lib/users/manage";

// What the calendar screens get back: clashes and suggested free times already worded.
export type BookingResult = {
  ok?: boolean;
  error?: CalendarError;
  problems?: string[];
  suggestions?: { date: string; time: string; label: string }[];
  warned?: string[];
  flexOnly?: boolean; // only «εκτός ωραρίου +30′»: one more click books it
  needsReason?: boolean; // off-hours / weekend: booking anyway needs a reason
  patientError?: string; // the new patient's details were refused (e.g. a bad email)
  eventId?: string; // a move: for «Αναίρεση» and the notify tick
};

async function actorNow() {
  const session = await requireSession();
  return loadActor(session.user.id);
}

const pad = (n: number) => String(n).padStart(2, "0");
const clock = (d: Date) => {
  const p = athensParts(d);
  return `${pad(p.hour)}:${pad(p.minute)}`;
};
const dayLabel = new Intl.DateTimeFormat("el-GR", { timeZone: "Europe/Athens", weekday: "short", day: "numeric", month: "numeric" });

type T = Awaited<ReturnType<typeof getTranslations<"calendar.problems">>>;
function describe(t: T, p: Problem): string {
  switch (p.kind) {
    case "appointment": return t("appointment", { from: clock(p.startsAt), to: clock(p.endsAt), label: p.label });
    case "patient": return t("patient", { from: clock(p.startsAt), to: clock(p.endsAt), label: p.label });
    case "block": return t("block", { from: clock(p.startsAt), to: clock(p.endsAt), label: p.label });
    case "holiday": return t("holiday", { label: p.label });
    default: return t(p.kind);
  }
}

// dd/mm/yyyy → yyyy-mm-dd (what the calendar library takes).
const isoOf = (v: unknown) => {
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = parseDayMonthYear(typeof v === "string" ? v : null);
  return d instanceof Date ? d.toISOString().slice(0, 10) : null;
};

async function result(r: { ok: true; overridden: Problem[] } | { ok: false; error: CalendarError; problems?: Problem[]; suggestions?: Date[] }): Promise<BookingResult> {
  const t = await getTranslations("calendar.problems");
  if (r.ok) {
    revalidatePath("/calendar");
    // A flex-zone booking is normal enough not to need a warning afterwards.
    return { ok: true, warned: r.overridden.filter((p) => p.kind !== "flex").map((p) => describe(t, p)) };
  }
  return {
    error: r.error,
    flexOnly: !!r.problems?.length && r.problems.every((p) => p.kind === "flex"),
    needsReason: !!r.problems?.some((p) => NEEDS_REASON.includes(p.kind)),
    problems: r.problems?.map((p) => describe(t, p)),
    suggestions: r.suggestions?.map((d) => ({ date: athensIsoDate(d), time: clock(d), label: `${dayLabel.format(d)} ${clock(d)}` })),
  };
}

export async function bookAction(raw: Record<string, unknown>): Promise<BookingResult> {
  const actor = await actorNow();
  const r = await createAppointment(actor, { ...raw, date: isoOf(raw.date) }, await requestContext());
  return result(r.ok ? { ok: true, overridden: r.overridden } : r);
}

export async function moveAction(id: string, raw: Record<string, unknown>): Promise<BookingResult> {
  const actor = await actorNow();
  const r = await moveAppointment(actor, id, { ...raw, date: isoOf(raw.date) }, await requestContext());
  revalidatePath("/");
  return { ...(await result(r)), ...(r.ok && { eventId: r.eventId }) };
}

export async function undoMoveAction(id: string, eventId: string): Promise<BookingResult> {
  const actor = await actorNow();
  const r = await undoMove(actor, id, eventId, await requestContext());
  revalidatePath("/");
  return result(r);
}

export async function moveNotifyAction(id: string, eventId: string, notify: boolean) {
  const actor = await actorNow();
  const r = await setMoveNotify(actor, id, eventId, notify, await requestContext());
  return r.ok ? { ok: true } : { error: r.error };
}

export async function statusAction(id: string, to: AppointmentStatus, opts: { room?: string; reason?: string } = {}): Promise<BookingResult> {
  // Cancelling goes through cancelAction (flags, waiting list).
  if (CANCEL_STATUSES.includes(to)) return { error: "not_allowed" };
  const actor = await actorNow();
  const r = await setAppointmentStatus(actor, id, to, opts, await requestContext());
  if (!r.ok) return { error: r.error };
  revalidatePath("/calendar");
  revalidatePath("/");
  return { ok: true };
}

// "Έναρξη επίσκεψης" (physician home): with the doctor, then the new visit for that patient.
export async function startVisitAction(id: string): Promise<BookingResult> {
  const actor = await actorNow();
  const r = await startVisit(actor, id, await requestContext());
  if (!r.ok) return { error: r.error };
  if (!r.patientId) return { ok: true };
  redirect(`/patients/${r.patientId}/visits/new?appointment=${id}`);
}

export async function historyAction(id: string) {
  const actor = await actorNow();
  const events = await appointmentHistory(actor, id);
  const when = new Intl.DateTimeFormat("el-GR", { timeZone: "Europe/Athens", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const t = await getTranslations("calendar.historyLine");
  const slot = new Intl.DateTimeFormat("el-GR", { timeZone: "Europe/Athens", weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return (events ?? []).map((e) => {
    const d = (e.details ?? {}) as { to?: string; undoOf?: string; notifyPatient?: boolean; overrideReason?: string };
    const what =
      e.action === "moved" ? (d.undoOf ? t("undo") : t("moved", { to: d.to ? slot.format(new Date(d.to)) : "" }))
      : e.action === "notify" ? t(d.notifyPatient ? "notifyOn" : "notifyOff")
      : e.toStatus ? STATUS_LABEL[e.toStatus] : e.action;
    return { id: e.id, at: when.format(e.at), by: e.byName ?? "", what: d.overrideReason && !d.undoOf ? `${what} (${d.overrideReason})` : what };
  });
}

// ── Quick booking (6a-6) ─────────────────────────────────────────────────────────────
export async function bookingSearchAction(q: string) {
  const actor = await actorNow();
  const company = await activeCompany(actor);
  return company ? ((await bookingSearch(actor, company.id, String(q).slice(0, 100))) ?? []) : [];
}

export async function duplicatesAction(raw: { name?: string; mobile?: string; email?: string }, excludeId?: string) {
  const actor = await actorNow();
  const company = await activeCompany(actor);
  return company ? ((await quickDuplicates(actor, company.id, raw, excludeId)) ?? []) : [];
}

// Is this time free? (the "18:35 – 19:00 · ελεύθερο ✓" line; nothing is saved)
export async function slotCheckAction(raw: Record<string, unknown>): Promise<BookingResult> {
  const actor = await actorNow();
  const r = await createAppointment(actor, { ...raw, date: isoOf(raw.date), dryRun: true, patientId: typeof raw.patientId === "string" ? raw.patientId : null }, await requestContext());
  if (r.ok) return { ok: true, warned: [] };
  const t = await getTranslations("calendar.problems");
  return { error: r.error, problems: r.problems?.map((p) => describe(t, p)), flexOnly: !!r.problems?.length && r.problems.every((p) => p.kind === "flex"), needsReason: !!r.problems?.some((p) => NEEDS_REASON.includes(p.kind)) };
}

export async function quickBookAction(raw: Record<string, unknown>): Promise<BookingResult> {
  const actor = await actorNow();
  const r = await quickBook(actor, { ...raw, date: isoOf(raw.date) }, await requestContext());
  if (!r.ok && "patientError" in r) return { error: "invalid_value", patientError: r.patientError };
  if (r.ok) revalidatePath("/");
  return result(r.ok ? { ok: true, overridden: r.overridden } : r);
}

// Arrival with «Επιβεβαίωση στοιχείων» (or skipped: the tags stay).
export async function arriveAction(id: string, raw: { confirm?: { firstName?: string; surname?: string; mobile?: string; email?: string }; skip?: boolean }): Promise<BookingResult> {
  const actor = await actorNow();
  const r = await arrive(actor, id, raw, await requestContext());
  if (!r.ok) return { error: r.error, ...("patientError" in r && { patientError: r.patientError }) };
  revalidatePath("/calendar");
  revalidatePath("/");
  return { ok: true };
}

// ── Cancel — never delete (6a-8) ─────────────────────────────────────────────────────
export async function cancelPreviewAction(id: string) {
  const actor = await actorNow();
  return cancelPreview(actor, id);
}

export async function cancelAction(id: string, raw: { kind: CancelKind; reason?: string }): Promise<{ ok?: boolean; error?: string; flag?: string | null; matches?: WaitlistMatch[]; resourceId?: string }> {
  const actor = await actorNow();
  const r = await cancelAppointment(actor, id, raw, await requestContext());
  if (!r.ok) return { error: r.error };
  revalidatePath("/calendar");
  revalidatePath("/");
  return { ok: true, flag: r.flag, matches: r.matches, resourceId: r.resourceId };
}

// ── Waiting list ─────────────────────────────────────────────────────────────────────
export async function waitlistAddAction(raw: Record<string, unknown>) {
  const actor = await actorNow();
  const company = await activeCompany(actor);
  if (!company) return { error: "not_found" };
  const r = await addToWaitlist(actor, company.id, raw, await requestContext());
  if (!r.ok) return { error: r.error };
  revalidatePath("/calendar");
  return { ok: true };
}

export async function waitlistRemoveAction(id: string, why: string) {
  const actor = await actorNow();
  const r = await removeFromWaitlist(actor, id, why, await requestContext());
  if (!r.ok) return { error: r.error };
  revalidatePath("/calendar");
  return { ok: true };
}

// «Κλείσιμο» for someone on the list: their type at the freed time; they leave the list.
export async function bookFromWaitlistAction(entryId: string, slot: { resourceId: string; date: string; time: string }): Promise<BookingResult> {
  const actor = await actorNow();
  const e = await db.waitlistEntry.findFirst({ where: { id: entryId, companyId: { in: actor.companyIds }, removedAt: null } });
  if (!e) return { error: "not_found" };
  const typeId = e.typeId ?? (await db.appointmentType.findFirst({ where: { companyId: e.companyId, isActive: true, layer: "OFFICE", forNewPatients: false }, orderBy: { sortOrder: "asc" } }))?.id;
  const ctx = await requestContext();
  const r = await createAppointment(actor, { patientId: e.patientId, typeId, resourceId: slot.resourceId, date: isoOf(slot.date), time: slot.time, reason: e.note ?? undefined }, ctx);
  if (r.ok) await removeFromWaitlist(actor, entryId, "booked", ctx);
  return result(r.ok ? { ok: true, overridden: r.overridden } : r);
}

// ── Patients waiting for a time (calendar v3 bubbles) ────────────────────────────────
export async function bubbleAddAction(raw: { patientId?: string; typeId?: string; newPatient?: { name?: string; mobile?: string } }) {
  const actor = await actorNow();
  const company = await activeCompany(actor);
  if (!company) return { error: "not_found" };
  const r = await addBubble(actor, company.id, raw, await requestContext());
  if (!r.ok) return { error: r.error };
  revalidatePath("/calendar");
  return { ok: true, id: r.id };
}

export async function bubbleRemoveAction(id: string) {
  const actor = await actorNow();
  const r = await removeBubble(actor, String(id), await requestContext());
  if (!r.ok) return { error: r.error };
  revalidatePath("/calendar");
  return { ok: true };
}

// Put the bubble on the picked time (a new patient's record is created then).
export async function bubbleBookAction(id: string, slot: { resourceId: string; date: string; time: string; flex?: boolean }): Promise<BookingResult & { patientId?: string | null }> {
  const actor = await actorNow();
  const r = await bookBubble(actor, String(id), { ...slot, date: isoOf(slot.date) }, await requestContext());
  if (!r.ok && "patientError" in r) return { error: "invalid_value", patientError: r.patientError as string };
  if (r.ok) revalidatePath("/");
  return { ...(await result(r.ok ? { ok: true, overridden: r.overridden } : r)), ...(r.ok && { patientId: r.patientId }) };
}
