import { athensParts, athensToUtc } from "@/lib/time";

// All sessions end every Monday at 05:00 Athens time (SPEC §11).
const EXPIRY_HOUR = 5;

export function nextWeeklyExpiry(now: Date = new Date()): Date {
  const p = athensParts(now);
  const daysToMonday = (1 - p.weekday + 7) % 7;
  let expiry = athensToUtc(p.year, p.month, p.day + daysToMonday, EXPIRY_HOUR);
  if (expiry <= now) expiry = athensToUtc(p.year, p.month, p.day + daysToMonday + 7, EXPIRY_HOUR);
  return expiry;
}
