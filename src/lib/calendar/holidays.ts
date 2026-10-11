// Greek public holidays (SPEC §4c "Greek public holidays pre-loaded"), worked out for any
// year: the fixed ones plus those that move with Orthodox Easter. Dates are Athens days.

const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

// Orthodox Easter Sunday (Meeus' Julian algorithm + 13 days to the Gregorian calendar,
// valid 1900–2099).
export function orthodoxEaster(year: number): { month: number; day: number } {
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const julian = new Date(Date.UTC(year, Math.floor((d + e + 114) / 31) - 1, ((d + e + 114) % 31) + 1));
  const g = new Date(julian.getTime() + 13 * 864e5);
  return { month: g.getUTCMonth() + 1, day: g.getUTCDate() };
}

export type Holiday = { date: string; name: string };

export function greekHolidays(year: number): Holiday[] {
  const easter = orthodoxEaster(year);
  const shift = (days: number) => {
    const d = new Date(Date.UTC(year, easter.month - 1, easter.day) + days * 864e5);
    return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  };
  return [
    { date: iso(year, 1, 1), name: "Πρωτοχρονιά" },
    { date: iso(year, 1, 6), name: "Θεοφάνεια" },
    { date: shift(-48), name: "Καθαρά Δευτέρα" },
    { date: iso(year, 3, 25), name: "25η Μαρτίου" },
    { date: shift(-2), name: "Μεγάλη Παρασκευή" },
    { date: shift(0), name: "Πάσχα" },
    { date: shift(1), name: "Δευτέρα του Πάσχα" },
    { date: iso(year, 5, 1), name: "Πρωτομαγιά" },
    { date: shift(50), name: "Αγίου Πνεύματος" },
    { date: iso(year, 8, 15), name: "Δεκαπενταύγουστος" },
    { date: iso(year, 10, 28), name: "28η Οκτωβρίου" },
    { date: iso(year, 12, 25), name: "Χριστούγεννα" },
    { date: iso(year, 12, 26), name: "Σύναξη της Θεοτόκου" },
  ].sort((x, y) => x.date.localeCompare(y.date));
}

const cache = new Map<number, Map<string, string>>();
// "2026-04-13" → "Δευτέρα του Πάσχα", or undefined.
export function holidayOn(isoDate: string): string | undefined {
  const year = Number(isoDate.slice(0, 4));
  if (!cache.has(year)) cache.set(year, new Map(greekHolidays(year).map((h) => [h.date, h.name])));
  return cache.get(year)!.get(isoDate);
}
