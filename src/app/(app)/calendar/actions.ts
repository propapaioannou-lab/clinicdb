"use server";

import { revalidatePath } from "next/cache";
import type { AppointmentStatus } from "@/generated/prisma/client";
import { requestContext, requireSession } from "@/lib/auth/current";
import { redirect } from "next/navigation";
import { appointmentHistory, createAppointment, moveAppointment, setAppointmentStatus, startVisit, type CalendarError, type Problem } from "@/lib/calendar/appointments";
import { STATUS_LABEL } from "@/lib/calendar/status";
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

function describe(p: Problem): string {
  switch (p.kind) {
    case "appointment": return `Υπάρχει ραντεβού ${clock(p.startsAt)}–${clock(p.endsAt)} (${p.label})`;
    case "patient": return `Ο ασθενής έχει ήδη ραντεβού ${clock(p.startsAt)}–${clock(p.endsAt)} (${p.label})`;
    case "block": return `Αποκλεισμός ${clock(p.startsAt)}–${clock(p.endsAt)} (${p.label})`;
    case "holiday": return `Αργία: ${p.label}`;
    case "outside_hours": return "Εκτός ωραρίου";
    case "past": return "Η ώρα έχει περάσει";
  }
}

// dd/mm/yyyy → yyyy-mm-dd (what the calendar library takes).
const isoOf = (v: unknown) => {
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = parseDayMonthYear(typeof v === "string" ? v : null);
  return d instanceof Date ? d.toISOString().slice(0, 10) : null;
};

function result(r: { ok: true; overridden: Problem[] } | { ok: false; error: CalendarError; problems?: Problem[]; suggestions?: Date[] }): BookingResult {
  if (r.ok) {
    revalidatePath("/calendar");
    return { ok: true, warned: r.overridden.map(describe) };
  }
  return {
    error: r.error,
    problems: r.problems?.map(describe),
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
  return result(await moveAppointment(actor, id, { ...raw, date: isoOf(raw.date) }, await requestContext()));
}

export async function statusAction(id: string, to: AppointmentStatus, opts: { room?: string; reason?: string } = {}): Promise<BookingResult> {
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
  return (events ?? []).map((e) => ({
    id: e.id,
    at: when.format(e.at),
    by: e.byName ?? "",
    what: e.action === "moved" ? "Μετακίνηση" : e.toStatus ? STATUS_LABEL[e.toStatus] : e.action,
  }));
}
