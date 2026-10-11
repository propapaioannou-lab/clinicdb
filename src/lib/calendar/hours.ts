// Working hours of a resource (Settings → Ημερολόγιο). Stored as
// [{ day: 1–6 (Mon=1 … Sat=6, Sun=7), from: "09:00", to: "14:00" }, …] in Athens time.
export type HoursRange = { day: number; from: string; to: string };

// Until the practice sets its own (SPEC §13): Mon–Fri 09:00–14:00 and 17:00–21:00.
export const DEFAULT_HOURS: HoursRange[] = [1, 2, 3, 4, 5].flatMap((day) => [
  { day, from: "09:00", to: "14:00" },
  { day, from: "17:00", to: "21:00" },
]);

const hm = /^([01]\d|2[0-3]):([0-5]\d)$/;
export const minutesOf = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

export function cleanHours(raw: unknown): HoursRange[] | null {
  if (!Array.isArray(raw)) return null;
  const out: HoursRange[] = [];
  for (const r of raw.slice(0, 50)) {
    if (!r || typeof r !== "object") return null;
    const { day, from, to } = r as Record<string, unknown>;
    if (!Number.isInteger(day) || (day as number) < 1 || (day as number) > 7) return null;
    if (typeof from !== "string" || typeof to !== "string" || !hm.test(from) || !hm.test(to) || minutesOf(from) >= minutesOf(to)) return null;
    out.push({ day: day as number, from, to });
  }
  return out.sort((a, b) => a.day - b.day || minutesOf(a.from) - minutesOf(b.from));
}

export const hoursOf = (raw: unknown): HoursRange[] => cleanHours(raw) ?? DEFAULT_HOURS;
