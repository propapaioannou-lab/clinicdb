// All sessions end every Monday at 05:00 Athens time (SPEC §11).
const TIME_ZONE = "Europe/Athens";
const EXPIRY_HOUR = 5;

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

function athensParts(d: Date) {
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
function athensToUtc(year: number, month: number, day: number, hour: number): Date {
  const guess = Date.UTC(year, month - 1, day, hour);
  const p = athensParts(new Date(guess));
  const offset = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - guess;
  return new Date(guess - offset);
}

export function nextWeeklyExpiry(now: Date = new Date()): Date {
  const p = athensParts(now);
  const daysToMonday = (1 - p.weekday + 7) % 7;
  let expiry = athensToUtc(p.year, p.month, p.day + daysToMonday, EXPIRY_HOUR);
  if (expiry <= now) expiry = athensToUtc(p.year, p.month, p.day + daysToMonday + 7, EXPIRY_HOUR);
  return expiry;
}
