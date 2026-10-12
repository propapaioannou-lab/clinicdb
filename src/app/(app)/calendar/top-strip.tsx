"use client";

import { useState } from "react";

export type Tile = {
  key: string;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "neutral" | "ok" | "warn" | "muted" | "primary";
  wide?: boolean;
  body?: React.ReactNode; // opens below the strip when the tile is clicked
};

const TONE = {
  neutral: "border-line bg-surface",
  ok: "border-ok/40 bg-ok-bg/50",
  warn: "border-warn-line bg-warn-bg/60",
  muted: "border-line-soft bg-surface-2 text-muted",
  primary: "border-primary bg-primary-tint",
};

// Top strip of tiles (DESIGN 6a–6g): what used to be the side widgets; a tile with more
// to show opens downward, one at a time, so the calendar keeps the full width.
export function TopStrip({ tiles, label }: { tiles: Tile[]; label: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const shown = tiles.find((x) => x.key === open && x.body);
  return (
    <section aria-label={label} className="flex flex-col gap-2">
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(170px, 1fr))` }}>
        {tiles.map((x) => {
          const inner = (
            <>
              <span className="text-[12px] font-semibold uppercase tracking-wide text-muted">{x.label}</span>
              <span className="text-[19px] font-semibold leading-tight">{x.value}</span>
              {x.sub && <span className="text-[12.5px] text-ink-3">{x.sub}</span>}
            </>
          );
          const cls = `flex min-h-[78px] flex-col items-start gap-0.5 rounded-card border px-3.5 py-2.5 text-left ${TONE[x.tone ?? "neutral"]} ${x.wide ? "sm:col-span-2" : ""}`;
          return x.body ? (
            <button key={x.key} type="button" aria-expanded={open === x.key} onClick={() => setOpen(open === x.key ? null : x.key)} className={`${cls} hover:border-primary ${open === x.key ? "ring-2 ring-primary" : ""}`}>
              {inner}
              <span className="mt-auto self-end text-[11px] text-muted" aria-hidden="true">{open === x.key ? "▴" : "▾"}</span>
            </button>
          ) : (
            <div key={x.key} className={cls}>{inner}</div>
          );
        })}
      </div>
      {shown && <div className="rounded-card border border-line bg-surface px-4 py-3 text-sm">{shown.body}</div>}
    </section>
  );
}
