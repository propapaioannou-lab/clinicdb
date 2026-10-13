import { db } from "@/lib/db";
import { audit, type RequestContext } from "@/lib/audit";
import type { AppointmentStatus, PatientFlag } from "@/generated/prisma/client";
import { canEditPatients } from "@/lib/permissions";
import { athensParts } from "@/lib/time";
import type { Actor } from "@/lib/users/manage";
import { setAppointmentStatus } from "./appointments";
import { calendarConfigOf } from "./config";
import { waitlistMatches } from "./waitlist";

// Cancel — never delete (SPEC §4c, 6a-8; DESIGN 6g panel 4).
//   cancel  «Ακύρωση»              (≥ 48 h before)  no flag
//   late    «Εκπρόθεσμη ακύρωση»   (< 48 h)         yellow flag; a 2nd within 12 months → red
//   no_show «Δεν ήρθε»                              red flag
//   error   «Λάθος καταχώριση»                      hidden, no flag (reason required)
// The 48 h / 12 months are in Settings. A flag is only ever raised automatically, never
// lowered (staff change it on the patient record, with a reason). Everything is logged.

export type CancelKind = "cancel" | "late" | "no_show" | "error";
export const CANCEL_KINDS: CancelKind[] = ["cancel", "late", "no_show", "error"];
const STATUS: Record<CancelKind, AppointmentStatus> = { cancel: "CANCELLED", late: "CANCELLED_LATE", no_show: "NO_SHOW", error: "ENTERED_IN_ERROR" };
// The flag-reason list items an automatic flag adds (Settings → Λίστες), by their label.
const REASON_LABEL: Partial<Record<CancelKind, string>> = { late: "Ακύρωσε την τελευταία στιγμή", no_show: "Δεν ήρθε στο ραντεβού" };
const RANK: Record<PatientFlag, number> = { NONE: 0, YELLOW: 1, RED: 2 };

async function load(actor: Actor, id: string) {
  if (!canEditPatients(actor.level)) return null;
  return db.appointment.findFirst({
    where: { id, companyId: { in: actor.companyIds } },
    include: { patient: { select: { id: true, flag: true, firstName: true, surname: true } }, type: { select: { labelEl: true } } },
  });
}

const minuteOf = (d: Date) => {
  const p = athensParts(d);
  return p.hour * 60 + p.minute;
};

async function priorLate(patientId: string, exceptId: string, months: number, now: Date) {
  const since = new Date(now);
  since.setUTCMonth(since.getUTCMonth() - months);
  return db.appointment.count({ where: { patientId, status: "CANCELLED_LATE", NOT: { id: exceptId }, startsAt: { gte: since } } });
}

// What the cancel panel shows before anything happens.
export async function cancelPreview(actor: Actor, id: string, now = new Date()) {
  const a = await load(actor, id);
  if (!a) return null;
  const cfg = await calendarConfigOf(a.companyId);
  const hoursUntil = (a.startsAt.getTime() - now.getTime()) / 36e5;
  const late = a.patientId ? await priorLate(a.patientId, a.id, cfg.lateMonths, now) : 0;
  const matches = await waitlistMatches(a.companyId, { startsAt: a.startsAt, endsAt: a.endsAt, start: minuteOf(a.startsAt), end: minuteOf(a.startsAt) + Math.round((a.endsAt.getTime() - a.startsAt.getTime()) / 60e3) }, a.patientId);
  return {
    hoursUntil,
    suggested: (hoursUntil < 0 ? "no_show" : hoursUntil < cfg.lateHours ? "late" : "cancel") as CancelKind,
    noShowAllowed: a.startsAt <= now,
    priorLate: late,
    lateHours: cfg.lateHours,
    lateMonths: cfg.lateMonths,
    flag: a.patient?.flag ?? null,
    lateFlag: late > 0 ? ("RED" as const) : ("YELLOW" as const),
    matches,
  };
}

export async function cancelAppointment(actor: Actor, id: string, raw: { kind?: unknown; reason?: unknown }, ctx: RequestContext, now = new Date()) {
  const a = await load(actor, id);
  if (!a) return { ok: false as const, error: "not_found" as const };
  const kind = CANCEL_KINDS.includes(raw.kind as CancelKind) ? (raw.kind as CancelKind) : null;
  const reason = typeof raw.reason === "string" ? raw.reason.replace(/\s+/g, " ").trim().slice(0, 200) : "";
  if (!kind) return { ok: false as const, error: "invalid_value" as const };
  if (kind === "error" && !reason) return { ok: false as const, error: "reason_needed" as const };
  if (kind === "no_show" && a.startsAt > now) return { ok: false as const, error: "not_yet" as const };
  const cfg = await calendarConfigOf(a.companyId);

  // The automatic flag (never lower than what the patient already has).
  let flag: PatientFlag | null = null;
  if (a.patient && (kind === "late" || kind === "no_show")) {
    const wanted: PatientFlag = kind === "no_show" || (await priorLate(a.patient.id, a.id, cfg.lateMonths, now)) > 0 ? "RED" : "YELLOW";
    flag = RANK[wanted] > RANK[a.patient.flag] ? wanted : a.patient.flag;
  }
  const r = await setAppointmentStatus(actor, id, STATUS[kind], { reason, note: { cancelKind: kind, ...(flag && { flag }) } }, ctx);
  if (!r.ok) return r;

  if (a.patient && flag) {
    const reasonItem = REASON_LABEL[kind] ? await db.listItem.findFirst({ where: { companyId: a.companyId, kind: "FLAG_REASON", label: REASON_LABEL[kind], isActive: true } }) : null;
    const raised = flag !== a.patient.flag;
    await db.$transaction([
      ...(raised ? [db.patient.update({ where: { id: a.patient.id }, data: { flag, flagSetAt: now, flagSetById: actor.id } })] : []),
      ...(reasonItem ? [db.patientFlagReason.createMany({ data: [{ patientId: a.patient.id, listItemId: reasonItem.id, companyId: a.companyId }], skipDuplicates: true })] : []),
    ]);
    await audit(
      {
        action: "patient.flag_changed", actor, companyId: a.companyId, entityType: "Patient", entityId: a.patient.id,
        details: { from: a.patient.flag, to: flag, automatic: true, because: kind, appointmentId: a.id, ...(reasonItem && { reasonAdded: reasonItem.label }) },
      },
      ctx,
    );
  }
  // The freed time, offered to the waiting list (not for «Δεν ήρθε»: that time is gone).
  const minutes = Math.round((a.endsAt.getTime() - a.startsAt.getTime()) / 60e3);
  const matches = kind === "no_show" ? [] : await waitlistMatches(a.companyId, { startsAt: a.startsAt, endsAt: a.endsAt, start: minuteOf(a.startsAt), end: minuteOf(a.startsAt) + minutes }, a.patientId);
  return { ok: true as const, flag, matches, resourceId: a.resourceId };
}
