// Working hours of a resource (Settings → Ημερολόγιο). Stored as
// [{ day: 1–7 (Mon=1 … Sun=7), from: "16:30", to: "20:00" }, …] in Athens time.
export type HoursRange = { day: number; from: string; to: string };

// Office hours (SPEC §4c, calendar v2): Mon, Tue, Thu 16:30–20:00.
export const DEFAULT_HOURS: HoursRange[] = [1, 2, 4].map((day) => ({ day, from: "16:30", to: "20:00" }));
// The hours the calendar had before v2; the Spa keeps them until it sets its own.
export const SPA_HOURS: HoursRange[] = [1, 2, 3, 4, 5].flatMap((day) => [
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

// ── Practice-wide calendar rules (Company.calendarConfig) ───────────────────────────
// surgery: the surgery window (Διαβαλκανικό) — surgery-type appointments go here.
// flexBefore / flexAfter: minutes just outside office hours that staff may book with
// one extra click («εκτός ωραρίου +30′»); online booking never offers them.
export type CalendarConfig = { surgery: HoursRange[]; flexBefore: number; flexAfter: number };

export const DEFAULT_CONFIG: CalendarConfig = {
  surgery: [1, 2, 3, 4, 5].map((day) => ({ day, from: "07:30", to: "14:00" })),
  flexBefore: 30,
  flexAfter: 30,
};
const NO_SURGERY: CalendarConfig = { surgery: [], flexBefore: 0, flexAfter: 0 };

const flexMinutes = (v: unknown, fallback: number) => (Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 120 ? (v as number) : fallback);

export function cleanConfig(raw: unknown, companyCode = "surgery"): CalendarConfig {
  const base = companyCode === "spa" ? NO_SURGERY : DEFAULT_CONFIG;
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;
  return {
    surgery: cleanHours(r.surgery) ?? base.surgery,
    flexBefore: flexMinutes(r.flexBefore, base.flexBefore),
    flexAfter: flexMinutes(r.flexAfter, base.flexAfter),
  };
}

export type Span = { from: number; to: number };
const spansOn = (hours: HoursRange[], weekday: number): Span[] => hours.filter((h) => h.day === weekday).map((h) => ({ from: minutesOf(h.from), to: minutesOf(h.to) }));

// One weekday of one resource: normal hours, the flex zones around them, the surgery window.
export function dayRules(hours: HoursRange[], cfg: CalendarConfig, weekday: number, opts: { surgeryWindow?: boolean } = {}) {
  const normal = spansOn(hours, weekday);
  const flex: Span[] = [];
  for (const s of normal) {
    if (cfg.flexBefore) flex.push({ from: Math.max(0, s.from - cfg.flexBefore), to: s.from });
    if (cfg.flexAfter) flex.push({ from: s.to, to: Math.min(24 * 60, s.to + cfg.flexAfter) });
  }
  // A flex zone never covers normal hours (e.g. two ranges close together).
  const clipped = flex.flatMap((f) => normal.reduce<Span[]>((parts, n) => parts.flatMap((p) => (p.to <= n.from || p.from >= n.to ? [p] : [...(p.from < n.from ? [{ from: p.from, to: n.from }] : []), ...(p.to > n.to ? [{ from: n.to, to: p.to }] : [])])), [f]));
  // …and overlapping zones (two ranges close together) become one.
  const merged: Span[] = [];
  for (const f of clipped.filter((x) => x.to > x.from).sort((x, y) => x.from - y.from)) {
    const last = merged[merged.length - 1];
    if (last && f.from <= last.to) last.to = Math.max(last.to, f.to);
    else merged.push({ ...f });
  }
  return { normal, flex: merged, surgery: opts.surgeryWindow ? spansOn(cfg.surgery, weekday) : [] };
}

// Where [start, end) falls for booking: "normal" (inside one normal range), "flex" (inside
// normal + flex, touching flex), "weekend" (Sat/Sun with no hours) or "off" (anything else).
export type SlotZone = "normal" | "flex" | "weekend" | "off";
export function zoneOf(rules: ReturnType<typeof dayRules>, weekday: number, start: number, end: number, opts: { surgery?: boolean } = {}): SlotZone {
  const ranges = opts.surgery ? rules.surgery : rules.normal;
  if (ranges.some((h) => h.from <= start && h.to >= end)) return "normal";
  if (!opts.surgery) {
    // Covered by normal ∪ flex without holes?
    const parts = [...rules.normal, ...rules.flex].sort((a, b) => a.from - b.from);
    let cur = start;
    for (const p of parts) if (p.from <= cur && p.to > cur) cur = p.to;
    if (cur >= end) return "flex";
  }
  if ((weekday === 6 || weekday === 7) && !ranges.length) return "weekend";
  return "off";
}
