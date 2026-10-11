// The practice runs on Athens time; the database stores real instants (UTC).
export const TIME_ZONE = "Europe/Athens";

const fmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
  weekday: "short",
});

export function athensParts(d: Date) {
  const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value]));
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour),
    minute: Number(p.minute),
    second: Number(p.second),
    weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday),
  };
}

// Athens wall-clock time -> real instant (handles summer/winter time).
export function athensToUtc(year: number, month: number, day: number, hour = 0): Date {
  const guess = Date.UTC(year, month - 1, day, hour);
  const p = athensParts(new Date(guess));
  const offset = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - guess;
  return new Date(guess - offset);
}

// "2026-12-31" -> the last moment of that day in Athens.
export function endOfAthensDay(isoDate: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) return null;
  return new Date(athensToUtc(Number(m[1]), Number(m[2]), Number(m[3]) + 1).getTime() - 1);
}

// Instant -> "2026-12-31" (Athens date), for date inputs.
export function athensIsoDate(d: Date): string {
  const p = athensParts(d);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}
