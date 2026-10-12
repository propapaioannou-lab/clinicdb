// Two-band time scale for the day and week views (DESIGN 6a–6g, calendar v2): the
// surgery window drawn compact, the office hours detailed (10′ appointments stay
// readable), and the hours between them folded into a thin strip. Pure functions, so
// server and browser draw exactly the same thing.

import type { Span } from "./hours";

export type Band = { kind: "surgery" | "office"; from: number; to: number; px: number; top: number };
export type Fold = { from: number; to: number; top: number; height: number };
export type Scale = { bands: Band[]; folds: Fold[]; height: number };

// Pixels per hour (DESIGN 6a–6g). An office band longer than 6 h (e.g. the Spa, open all
// day) is drawn less tall so the page does not become endless.
export const SCALE_PX = {
  day: { surgery: 52, office: 144, officeLong: 96, fold: 26 },
  week: { surgery: 40, office: 112, officeLong: 64, fold: 22 },
} as const;

const down30 = (m: number) => Math.floor(m / 30) * 30;
const up30 = (m: number) => Math.ceil(m / 30) * 30;

// surgery: the surgery window(s) of the days shown; office: office hours + flex zones;
// items: anything booked, so nothing ever falls outside the drawing.
export function buildScale(input: { surgery: Span[]; office: Span[]; items: Span[] }, size: keyof typeof SCALE_PX): Scale {
  const px = SCALE_PX[size];
  const lo = (xs: Span[]) => Math.min(...xs.map((x) => x.from));
  const hi = (xs: Span[]) => Math.max(...xs.map((x) => x.to));
  // Surgery band: the window plus 30′ for a case that runs over (14:00 → 14:30).
  let s = input.surgery.length ? { from: down30(lo(input.surgery)), to: up30(hi(input.surgery)) + 30 } : null;
  let o = input.office.length ? { from: down30(lo(input.office)), to: up30(hi(input.office)) } : null;
  if (!s && !o) o = { from: 9 * 60, to: 21 * 60 };
  if (s && o && s.to >= o.from) {
    // Overlapping windows: one band each side of the office start.
    s.to = o.from;
    if (s.to <= s.from) s = null;
  }
  for (const it of input.items) {
    const a = down30(it.from);
    const b = up30(Math.max(it.to, it.from + 10));
    if (s && o) {
      if (a < s.from) s.from = a;
      if (b > o.to) o.to = b;
      // In the fold: widen the nearer band.
      if (a < o.from && b > s.to) {
        if (a - s.to <= o.from - b) s.to = Math.max(s.to, Math.min(b, o.from));
        else o.from = Math.min(o.from, Math.max(a, s.to));
      }
    } else {
      const only = (s ?? o)!;
      only.from = Math.min(only.from, a);
      only.to = Math.max(only.to, b);
    }
  }
  const bands: Band[] = [];
  const folds: Fold[] = [];
  let top = 0;
  if (s) {
    bands.push({ kind: "surgery", ...s, px: px.surgery, top });
    top += ((s.to - s.from) / 60) * px.surgery;
  }
  if (o) {
    if (s && o.from > s.to) {
      folds.push({ from: s.to, to: o.from, top, height: px.fold });
      top += px.fold;
    }
    const officePx = o.to - o.from > 6 * 60 ? px.officeLong : px.office;
    bands.push({ kind: "office", ...o, px: officePx, top });
    top += ((o.to - o.from) / 60) * officePx;
  }
  return { bands, folds, height: Math.round(top) };
}

// Minute of the day → pixels from the top. Inside a fold: spread over the fold's height.
export function yOf(scale: Scale, min: number): number {
  const first = scale.bands[0];
  if (min <= first.from) return first.top;
  for (const b of scale.bands) if (min >= b.from && min <= b.to) return b.top + ((min - b.from) / 60) * b.px;
  for (const f of scale.folds) if (min > f.from && min < f.to) return f.top + ((min - f.from) / (f.to - f.from)) * f.height;
  return scale.height;
}

// Hour lines to draw: every hour in a band, and the half hours in a detailed band.
export function ticks(scale: Scale): { min: number; y: number; major: boolean }[] {
  const out: { min: number; y: number; major: boolean }[] = [];
  for (const b of scale.bands) {
    const step = b.px >= 100 ? 30 : 60;
    for (let m = Math.ceil(b.from / step) * step; m <= b.to; m += step) out.push({ min: m, y: yOf(scale, m), major: m % 60 === 0 });
  }
  return out.filter((t, i, all) => all.findIndex((x) => x.min === t.min) === i);
}

// Which band a minute is in (the now-line and auto-scroll work per band).
export const bandAt = (scale: Scale, min: number) => scale.bands.find((b) => min >= b.from && min <= b.to) ?? null;
