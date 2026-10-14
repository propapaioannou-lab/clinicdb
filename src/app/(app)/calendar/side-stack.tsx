"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import type { Bubble } from "@/lib/calendar/bubbles";
import { calColor } from "@/lib/calendar/colors";
import { byPriority, nextChange } from "@/lib/calendar/priority";
import { bubbleRemoveAction } from "./actions";
import { CalendarSearch, type SearchType } from "./calendar-search";
import { StatusLine, TileBox, type Tile } from "./top-strip";

const ago = (iso: string, now: number) => Math.max(0, Math.round((now - new Date(iso).getTime()) / 60e3));

// The right-hand column of the calendar (calendar v3, 14 Oct 2026, from the owner's
// layout board): the search box, then the patients waiting for a time (bubbles, newest
// first), then the cards, ordered by priority (lib/calendar/priority) and re-ordered as
// time passes — a patient's card rises when their time comes, new things go on top.
// `row` = the narrow-screen version: search and bubbles in one line above the calendar.
export function SideStack({ tiles, bubbles, placeHref, carrying, types, newType, row, label }: {
  tiles: Tile[];
  bubbles: Bubble[];
  placeHref: Record<string, string>; // bubble id → the calendar carrying it
  carrying: string | null; // the bubble being placed now
  types: SearchType[];
  newType: SearchType | null;
  row?: boolean;
  label: string;
}) {
  const t = useTranslations("calendar.bubble");
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState<string | null>(null);
  const [asking, setAsking] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Re-sort every half minute, and exactly when a card's priority changes.
  useEffect(() => {
    const at = nextChange(tiles, new Date(now));
    const wait = Math.min(30_000, at ? at.getTime() - Date.now() + 50 : 30_000);
    const id = setTimeout(() => setNow(Date.now()), Math.max(1_000, wait));
    return () => clearTimeout(id);
  }, [now, tiles]);

  const remove = (id: string) =>
    start(async () => {
      await bubbleRemoveAction(id);
      setAsking(null);
      router.refresh();
    });

  const sorted = byPriority(tiles.filter((x) => !x.status), new Date(now));
  const status = tiles.filter((x) => x.status);

  const bubble = (b: Bubble) => {
    const on = carrying === b.id;
    const c = b.color ? calColor(b.color) : null;
    return (
      <li key={b.id} className={`relative flex min-w-0 flex-col gap-1 rounded-[14px] border-2 bg-surface px-3.5 py-2.5 shadow-[0_6px_18px_rgba(28,32,36,0.12)] ${on ? "border-primary ring-2 ring-primary/30" : "border-cal-blue/40"} ${row ? "w-[240px] shrink-0" : ""}`}>
        <button type="button" onClick={() => router.push(placeHref[b.id])} disabled={on} className="flex min-w-0 flex-col gap-0.5 pr-7 text-left">
          <span className="flex items-center gap-2">
            <b className="truncate text-[14.5px]">{b.name}</b>
            {b.isNew && <span className="shrink-0 rounded-full bg-primary-tint px-2 py-0.5 text-[11px] font-semibold text-primary">{t("new")}</span>}
          </span>
          <span className="flex items-center gap-1.5 text-[12.5px] text-ink-3">
            {c && <span className={`h-2.5 w-2.5 shrink-0 rounded-[3px] ${c.dot}`} aria-hidden="true" />}
            <span className="truncate">{[b.type && `${b.type} ${b.minutes}′`, b.phone].filter(Boolean).join(" · ")}</span>
          </span>
          <span className="text-[11.5px] text-muted">{t("since", { by: b.by, minutes: ago(b.since, now) })}</span>
          <span className="mt-1 text-[12.5px] font-semibold text-primary">{on ? t("placing") : `${t("place")} →`}</span>
        </button>
        {asking === b.id ? (
          <span className="flex flex-wrap items-center gap-2 border-t border-line-soft pt-2 text-[12.5px]">
            <span className="flex-1">{t("removeAsk")}</span>
            <button type="button" disabled={pending} onClick={() => remove(b.id)} className="rounded-[8px] bg-danger px-2.5 py-1.5 font-semibold text-white">{t("removeYes")}</button>
            <button type="button" disabled={pending} onClick={() => setAsking(null)} className="rounded-[8px] border border-line-strong px-2.5 py-1.5">{t("removeNo")}</button>
          </span>
        ) : (
          <button type="button" onClick={() => setAsking(b.id)} aria-label={t("remove", { name: b.name })} title={t("remove", { name: b.name })}
            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full text-[16px] text-muted hover:bg-line-softer hover:text-ink">×</button>
        )}
      </li>
    );
  };

  if (row)
    return (
      <section aria-label={label} className="flex items-start gap-3">
        <div className="w-[260px] shrink-0"><CalendarSearch types={types} newType={newType} /></div>
        {bubbles.length > 0 && <ul className="flex min-w-0 gap-2 overflow-x-auto pb-2">{bubbles.map(bubble)}</ul>}
      </section>
    );

  return (
    <aside aria-label={label} className="sticky top-3 flex max-h-[calc(100vh-24px)] flex-col gap-2.5 overflow-y-auto pb-16">
      <CalendarSearch types={types} newType={newType} />
      {bubbles.length > 0 && (
        <section aria-label={t("title")} className="flex flex-col gap-2">
          <h2 className="px-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">{t("title")} · {bubbles.length}</h2>
          <ul className="flex flex-col gap-2">{bubbles.map(bubble)}</ul>
        </section>
      )}
      {sorted.map((x) => (
        <div key={x.key} className="flex flex-col gap-1.5">
          <TileBox x={x} open={open === x.key} toggle={() => setOpen(open === x.key ? null : x.key)} stacked />
          {open === x.key && x.body && <div className="rounded-card border border-line bg-surface px-3.5 py-3 text-sm">{x.body}</div>}
        </div>
      ))}
      {status.map((x) => <div key={x.key} className="px-1 pt-1"><StatusLine x={x} /></div>)}
    </aside>
  );
}
