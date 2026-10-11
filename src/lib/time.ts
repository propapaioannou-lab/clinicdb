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
export function athensToUtc(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
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

// "2026-12-31" -> the first moment of that day in Athens.
export function startOfAthensDay(isoDate: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) return null;
  return athensToUtc(Number(m[1]), Number(m[2]), Number(m[3]));
}

// "5/3/2026" + "09:30" (Athens) -> instant; null if either is not a real date/time.
export function athensDateTime(dmy: string, hm: string): Date | null {
  const d = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(dmy.trim());
  const t = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!d || !t) return null;
  const [day, month, year, hour, minute] = [Number(d[1]), Number(d[2]), Number(d[3]), Number(t[1]), Number(t[2])];
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCMonth() !== month - 1) return null;
  return athensToUtc(year, month, day, hour, minute);
}

// Instant -> { date: "05/03/2026", time: "09:30" } in Athens, for the form fields.
export function athensDateTimeFields(d: Date) {
  const p = athensParts(d);
  const two = (n: number) => String(n).padStart(2, "0");
  return { date: `${two(p.day)}/${two(p.month)}/${p.year}`, time: `${two(p.hour)}:${two(p.minute)}` };
}
