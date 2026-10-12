import { ticks, yOf, type Scale } from "@/lib/calendar/bands";

// Drawing pieces of the two-band grid (DESIGN 6a–6g), shared by the day and week views
// (server and browser). Labels come in as props so this file needs no translations.

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
type Span = { from: number; to: number };

// Hatched = flex zone («εκτός ωραρίου +30′»); also used for the folded hours.
export const hatch = "bg-[repeating-linear-gradient(135deg,var(--color-surface)_0_5px,var(--color-line-softer)_5px_9px)]";

export function TimeAxis({ scale }: { scale: Scale }) {
  return (
    <div className="relative" aria-hidden="true">
      {ticks(scale).map((t) => (
        <span key={t.min} className={`absolute right-1.5 -translate-y-1/2 tabular-nums ${t.major ? "text-[12px] text-muted" : "text-[10.5px] text-placeholder"}`} style={{ top: t.y }}>
          {hhmm(t.min)}
        </span>
      ))}
    </div>
  );
}

// Hour lines across a column (half hours fainter in the detailed band).
export function GridLines({ scale }: { scale: Scale }) {
  return (
    <>
      {ticks(scale).map((t) => (
        <div key={t.min} aria-hidden="true" className={`pointer-events-none absolute inset-x-0 border-t ${t.major ? "border-line-soft" : "border-dashed border-line-softer"}`} style={{ top: t.y }} />
      ))}
    </>
  );
}

// The folded hours between the two bands (e.g. 14:30–16:00), across the whole grid.
export function Folds({ scale, left, label }: { scale: Scale; left: number; label: string }) {
  return (
    <>
      {scale.folds.map((f) => (
        <div key={f.from} className="pointer-events-none absolute right-0 z-[1] flex items-center justify-center border-y border-line bg-line-softer text-[11.5px] text-muted" style={{ top: f.top, height: f.height, left: 0 }}>
          <span style={{ marginLeft: left }}>{label} · {hhmm(f.from)}–{hhmm(f.to)}</span>
        </div>
      ))}
    </>
  );
}

// One column's background: closed (grey), surgery window (tint), office hours (white),
// flex zones (hatched).
export function ColumnBackground({ scale, surgery, hours, flex, surgeryLabel }: { scale: Scale; surgery: Span[]; hours: Span[]; flex: Span[]; surgeryLabel?: string }) {
  const box = (s: Span) => ({ top: yOf(scale, s.from), height: Math.max(0, yOf(scale, s.to) - yOf(scale, s.from)) });
  return (
    <>
      <div className="absolute inset-0 bg-cal-closed" aria-hidden="true" />
      {surgery.map((s) => (
        <div key={`s${s.from}`} className="absolute inset-x-0 bg-cal-surgery-tint" style={box(s)}>
          {surgeryLabel && <span className="absolute left-1.5 top-1 text-[11px] font-semibold uppercase tracking-wide text-cal-blue/55">{surgeryLabel}</span>}
        </div>
      ))}
      {hours.map((h) => <div key={`h${h.from}`} className="absolute inset-x-0 bg-surface" style={box(h)} />)}
      {flex.map((f) => <div key={`f${f.from}`} className={`absolute inset-x-0 ${hatch}`} style={box(f)} />)}
    </>
  );
}

export const place = (scale: Scale, start: number, end: number, min = 18) => {
  const top = yOf(scale, start);
  return { top: top + 1, height: Math.max(min, yOf(scale, end) - top - 2) };
};
