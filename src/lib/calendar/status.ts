import type { AppointmentStatus } from "@/generated/prisma/client";
import { canEditPatients, canHandleMoney } from "@/lib/permissions";
import type { Actor } from "@/lib/users/manage";

// The ONLY appointment status list (SPEC §4c), in order, with the Greek labels.
export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  BOOKED: "Κλείστηκε",
  CONFIRMED: "Επιβεβαιώθηκε",
  ARRIVED: "Στην αναμονή",
  READY: "Έτοιμος",
  WITH_DOCTOR: "Με τον γιατρό",
  TO_PAY: "Προς πληρωμή",
  DONE: "Ολοκληρώθηκε",
  CANCELLED: "Ακυρώθηκε",
  NO_SHOW: "Δεν ήρθε",
  CANCELLED_LATE: "Εκπρόθεσμη ακύρωση",
  ENTERED_IN_ERROR: "Λάθος καταχώριση",
};

// Cancelled in some way (never deleted, SPEC §4c). «Λάθος καταχώριση» is never shown on
// the calendar; the others only with «Εμφάνιση ακυρωμένων».
export const CANCEL_STATUSES: AppointmentStatus[] = ["CANCELLED", "CANCELLED_LATE", "NO_SHOW", "ENTERED_IN_ERROR"];

// Statuses that take up time on the calendar (cancelled / no-show free it again).
export const ACTIVE_STATUSES: AppointmentStatus[] = ["BOOKED", "CONFIRMED", "ARRIVED", "READY", "WITH_DOCTOR", "TO_PAY", "DONE"];

// Allowed next steps. One step back is allowed too (a mistaken tap), always logged.
const NEXT: Record<AppointmentStatus, AppointmentStatus[]> = {
  BOOKED: ["CONFIRMED", "ARRIVED", "CANCELLED", "CANCELLED_LATE", "NO_SHOW", "ENTERED_IN_ERROR"],
  CONFIRMED: ["ARRIVED", "CANCELLED", "CANCELLED_LATE", "NO_SHOW", "ENTERED_IN_ERROR", "BOOKED"],
  ARRIVED: ["READY", "WITH_DOCTOR", "CANCELLED", "CANCELLED_LATE", "ENTERED_IN_ERROR", "CONFIRMED"],
  READY: ["WITH_DOCTOR", "ARRIVED"],
  WITH_DOCTOR: ["TO_PAY", "DONE", "READY"],
  TO_PAY: ["DONE", "WITH_DOCTOR"],
  DONE: ["TO_PAY"],
  CANCELLED: ["BOOKED"],
  NO_SHOW: ["BOOKED"],
  CANCELLED_LATE: ["BOOKED"],
  ENTERED_IN_ERROR: ["BOOKED"],
};

export const nextStatuses = (from: AppointmentStatus) => NEXT[from];

export type StatusRefusal = "not_allowed" | "forbidden";

// May this person move the appointment from → to? "Done" after "to pay" is money: the
// secretary or PA/nurse (the surgeon never handles payments).
export function checkTransition(actor: Pick<Actor, "level" | "role">, from: AppointmentStatus, to: AppointmentStatus): StatusRefusal | null {
  if (!canEditPatients(actor.level)) return "forbidden";
  if (!NEXT[from].includes(to)) return "not_allowed";
  if (from === "TO_PAY" && to === "DONE" && !canHandleMoney(actor)) return "forbidden";
  return null;
}
