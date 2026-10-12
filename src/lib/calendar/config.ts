import { db } from "@/lib/db";
import { cleanConfig, type CalendarConfig } from "./hours";

// The practice's calendar rules (surgery window, flex zones); defaults until set in Settings.
export async function calendarConfigOf(companyId: string): Promise<CalendarConfig> {
  const c = await db.company.findUnique({ where: { id: companyId }, select: { code: true, calendarConfig: true } });
  return cleanConfig(c?.calendarConfig, c?.code);
}
