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
};

// Statuses that take up time on the calendar (cancelled / no-show free it again).
export const ACTIVE_STATUSES: AppointmentStatus[] = ["BOOKED", "CONFIRMED", "ARRIVED", "READY", "WITH_DOCTOR", "TO_PAY", "DONE"];

// Allowed next steps. One step back is allowed too (a mistaken tap), always logged.
const NEXT: Record<AppointmentStatus, AppointmentStatus[]> = {
  BOOKED: ["CONFIRMED", "ARRIVED", "CANCELLED", "NO_SHOW"],
  CONFIRMED: ["ARRIVED", "CANCELLED", "NO_SHOW", "BOOKED"],
  ARRIVED: ["READY", "WITH_DOCTOR", "CANCELLED", "CONFIRMED"],
  READY: ["WITH_DOCTOR", "ARRIVED"],
  WITH_DOCTOR: ["TO_PAY", "DONE", "READY"],
  TO_PAY: ["DONE", "WITH_DOCTOR"],
  DONE: ["TO_PAY"],
  CANCELLED: ["BOOKED"],
  NO_SHOW: ["BOOKED"],
};

export type StatusRefusal = "not_allowed" | "forbidden";

// May this person move the appointment from → to? "Done" after "to pay" is money: the
// secretary or PA/nurse (the surgeon never handles payments).
export function checkTransition(actor: Pick<Actor, "level" | "role">, from: AppointmentStatus, to: AppointmentStatus): StatusRefusal | null {
  if (!canEditPatients(actor.level)) return "forbidden";
  if (!NEXT[from].includes(to)) return "not_allowed";
  if (from === "TO_PAY" && to === "DONE" && !canHandleMoney(actor)) return "forbidden";
  return null;
}
