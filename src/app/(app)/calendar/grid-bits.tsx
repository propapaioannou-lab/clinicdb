import { ticks, yOf, type Scale } from "@/lib/calendar/bands";
import { calColor } from "@/lib/calendar/colors";

// Drawing pieces of the two-band grid (DESIGN 6a–6g), shared by the day and week views
// (server and browser). Labels come in as props so this file needs no translations.

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
type Span = { from: number; to: number };
export const dur = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}ω${min % 60 ? ` ${min % 60}′` : ""}` : `${min}′`);

// Hatched = flex zone («εκτός ωραρίου +30′»); also used for the folded hours.
export const hatch = "bg-[repeating-linear-gradient(135deg,var(--color-surface)_0_5px,var(--color-line-softer)_5px_9px)]";

// Hours on the left, with the band names written upwards (ΧΕΙΡΟΥΡΓΕΙΟ / ΙΑΤΡΕΙΟ).
export function TimeAxis({ scale, labels }: { scale: Scale; labels?: { surgery: string; office: string } }) {
  return (
    <div className="relative" aria-hidden="true">
      {labels && scale.bands.length > 1 && scale.bands.map((b) => (
        <span key={b.kind} className="absolute left-1 flex items-center justify-center text-[10.5px] font-bold uppercase tracking-[0.12em] text-cal-blue/70 [writing-mode:vertical-rl] rotate-180"
          style={{ top: b.top, height: ((b.to - b.from) / 60) * b.px }}>
          {labels[b.kind]}
        </span>
      ))}
      {ticks(scale).map((t) => (
        <span key={t.min} className={`absolute right-1.5 tabular-nums ${t.y < 8 ? "" : "-translate-y-1/2"} ${t.major ? "text-[12px] text-muted" : "text-[10.5px] text-placeholder"}`} style={{ top: t.y }}>
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
        <div key={f.from} className="pointer-events-none absolute right-0 z-[1] flex items-center border-y border-line bg-line-softer text-[11.5px] text-muted" style={{ top: f.top, height: f.height, left: 0 }}>
          <span style={{ marginLeft: left + 8 }}>{hhmm(f.from)} – {hhmm(f.to)} {label}</span>
        </div>
      ))}
    </>
  );
}

// One column's background: closed (grey), surgery window (tint) and the 30′ after it
// (hatched: over-run), office hours (white), flex zones (hatched, labelled once).
export function ColumnBackground({ scale, surgery, hours, flex, labels }: { scale: Scale; surgery: Span[]; hours: Span[]; flex: Span[]; labels?: { overrun: string; flex: string } }) {
  const box = (s: Span) => ({ top: yOf(scale, s.from), height: Math.max(0, yOf(scale, s.to) - yOf(scale, s.from)) });
  const tag = "absolute left-2 top-1 text-[11px] text-muted";
  return (
    <>
      <div className="absolute inset-0 bg-cal-closed" aria-hidden="true" />
      {surgery.map((s) => <div key={`s${s.from}`} className="absolute inset-x-0 bg-cal-surgery-tint" style={box(s)} />)}
      {surgery.map((s) => (
        <div key={`o${s.from}`} className={`absolute inset-x-0 ${hatch}`} style={box({ from: s.to, to: s.to + 30 })}>
          {labels && <span className={tag}>{labels.overrun.replace("{time}", hhmm(s.to))}</span>}
        </div>
      ))}
      {hours.map((h) => <div key={`h${h.from}`} className="absolute inset-x-0 bg-surface" style={box(h)} />)}
      {flex.map((f, i) => (
        <div key={`f${f.from}`} className={`absolute inset-x-0 ${hatch}`} style={box(f)}>
          {labels && i === 0 && <span className={tag}>{labels.flex}</span>}
        </div>
      ))}
    </>
  );
}

// Colour key under the grid (DESIGN 6a–6g): each type with its length, then the zones.
export function Legend({ types, zones }: { types: { label: string; minutes: number; color: string }[]; zones: { flex: string; closed: string; extra?: React.ReactNode } }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line-soft px-4 py-2.5 text-[12.5px] text-ink-3">
      {types.map((t) => (
        <span key={t.label} className="flex items-center gap-1.5">
          <span className={`h-3 w-3 rounded-[3px] ${t.color === "online" ? "border border-dashed border-cal-teal" : calColor(t.color).dot}`} />
          {t.label}{t.minutes ? ` ${t.minutes >= 60 ? "" : `${t.minutes}′`}` : ""}
        </span>
      ))}
      <span className="flex items-center gap-1.5"><span className={`h-3 w-3 rounded-[3px] border border-line ${hatch}`} />{zones.flex}</span>
      <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-[3px] bg-cal-closed" />{zones.closed}</span>
      {zones.extra}
    </div>
  );
}

export const place = (scale: Scale, start: number, end: number, min = 18) => {
  const top = yOf(scale, start);
  return { top: top + 1, height: Math.max(min, yOf(scale, end) - top - 2) };
};

// The text inside an appointment card: two lines when it is tall enough (time + name,
// then type · reason), one line for short ones (DESIGN 6a–6g). Surgeries show their time
// range and the procedure.
export function CardText({ h, time, end, name, type, reason, surgery, extra }: { h: number; time: string; end: number; name: string; type: string; reason: string | null; surgery?: boolean; extra?: React.ReactNode }) {
  const when = surgery ? `${time}–${hhmm(end)}` : time;
  const detail = surgery ? reason ?? type : [type, reason].filter(Boolean).join(" · ");
  if (h >= 34)
    return (
      <span className="flex min-w-0 flex-col gap-0.5 leading-tight">
        <span className="truncate"><b>{when}</b> <b>{name}</b>{extra}</span>
        <span className="truncate opacity-80">{detail}</span>
      </span>
    );
  return <span className="min-w-0 truncate"><b>{when}</b> <b>{name}</b>{extra} <span className="opacity-80">· {detail}</span></span>;
}

// Surgery time of a day against the window (DESIGN 6a–6g week header / physician week):
// "Χ 5ω 30′ · πλήρες". Red when it runs over the window.
export function SurgeryBar({ load, text }: { load: { used: number; window: number; state: string }; text: string }) {
  const over = load.state === "over";
  const pct = load.window ? Math.min(100, (100 * load.used) / load.window) : 100;
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 min-w-8 flex-1 overflow-hidden rounded-full bg-line-softer"><span className={`block h-full rounded-full ${over ? "bg-danger" : "bg-cal-blue"}`} style={{ width: `${pct}%` }} /></span>
      <span className={`shrink-0 text-[11.5px] font-semibold ${over ? "text-danger-ink" : "text-cal-blue"}`}>{text}</span>
    </span>
  );
}
