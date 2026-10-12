"use client";

import { useState } from "react";

export type Tile = {
  key: string;
  label: string; // small heading (cards) or bold title (chips)
  value?: React.ReactNode;
  sub?: React.ReactNode;
  badge?: { text: string; tone: "navy" | "warn" | "grey" | "ok" }; // makes it a chip
  status?: boolean; // a status line on the right (GHL), no box
  tone?: "neutral" | "primary" | "muted";
  wide?: boolean;
  action?: React.ReactNode; // e.g. «Καρτέλα»
  body?: React.ReactNode; // opens below the strip when the tile is clicked
};

const BADGE = { navy: "bg-cal-blue text-white", warn: "bg-warn text-white", grey: "bg-line text-ink-3", ok: "bg-ok text-white" };

// Top strip (DESIGN 6a–6g): what used to be the side widgets. Front desk: chips with a
// count, opening downward one at a time; the GHL status on the right. Physician: small
// cards (Τώρα · Επόμενος · Σήμερα · Αύριο). The calendar keeps the full width.
export function TopStrip({ tiles, label }: { tiles: Tile[]; label: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const shown = tiles.find((x) => x.key === open && x.body);
  const boxes = tiles.filter((x) => !x.status);
  const status = tiles.filter((x) => x.status);
  return (
    <section aria-label={label} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-stretch gap-2">
        {boxes.map((x) => {
          const isOpen = open === x.key;
          const inner = x.badge ? (
            <>
              <span className={`flex h-8 min-w-8 shrink-0 items-center justify-center rounded-[8px] px-1.5 text-[13px] font-bold ${BADGE[x.badge.tone]}`}>{x.badge.text}</span>
              <span className="flex min-w-0 flex-col text-left">
                <span className="text-[14px] font-semibold leading-tight">{x.label}</span>
                {x.sub && <span className="truncate text-[12px] text-muted">{x.sub}</span>}
              </span>
            </>
          ) : (
            <span className="flex min-w-0 flex-1 flex-col text-left">
              <span className="text-[12px] text-muted">{x.label}</span>
              {x.value && <span className="truncate text-[15px] font-semibold leading-snug">{x.value}</span>}
              {x.sub && <span className="text-[12.5px] text-ink-3">{x.sub}</span>}
            </span>
          );
          const cls = `flex min-h-[56px] min-w-0 items-center gap-3 rounded-[12px] border bg-surface px-3.5 py-2 ${x.tone === "primary" || isOpen ? "border-2 border-primary" : "border-line"} ${x.tone === "muted" ? "opacity-70" : ""} ${x.badge ? "" : x.wide ? "flex-[2_1_320px]" : "flex-[1_1_170px]"}`;
          if (x.body && !x.action)
            return (
              <button key={x.key} type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : x.key)} className={`${cls} hover:border-primary`}>
                {inner}
                <span className="ml-1 text-[11px] text-muted" aria-hidden="true">{isOpen ? "▴" : "▾"}</span>
              </button>
            );
          return (
            <div key={x.key} className={cls}>
              {inner}
              {x.action && <span className="ml-auto shrink-0">{x.action}</span>}
            </div>
          );
        })}
        {status.map((x) => (
          <span key={x.key} className="ml-auto flex items-center gap-1.5 self-center text-[12.5px] text-muted">
            <span className={`h-2 w-2 rounded-full ${x.tone === "primary" ? "bg-ok" : "bg-line-strong"}`} />
            <b className="font-semibold">{x.label}</b> {x.value}{x.sub && <> · {x.sub}</>}
          </span>
        ))}
      </div>
      {shown && <div className="rounded-card border border-line bg-surface px-4 py-3 text-sm">{shown.body}</div>}
    </section>
  );
}
