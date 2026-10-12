"use client";

import { useEffect, useRef, useState } from "react";
import { bandAt, yOf, type Scale } from "@/lib/calendar/bands";

const athensNow = () => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Athens", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { iso: `${p.year}-${p.month}-${p.day}`, minute: Number(p.hour) * 60 + Number(p.minute) };
};

const scroller = (el: HTMLElement | null) => {
  for (let x = el?.parentElement; x; x = x.parentElement) if (/(auto|scroll)/.test(getComputedStyle(x).overflowY)) return x;
  return null;
};

// Red "now" line on a two-band grid (moves every 30 s; hidden in the folded hours). On
// opening, the grid scrolls to it — or, on another day, to `focus` (the office band).
export function NowLine({ dates, scale, left = 0, focus }: { dates: string[]; scale: Scale; left?: number | string; focus?: number }) {
  const [now, setNow] = useState<{ iso: string; minute: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const scrolled = useRef(false);
  useEffect(() => {
    const tick = () => setNow(athensNow());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);
  const showing = !!now && dates.includes(now.iso) && !!bandAt(scale, now.minute);
  useEffect(() => {
    if (!now || scrolled.current) return;
    scrolled.current = true;
    const box = scroller(ref.current);
    if (!box) return;
    const target = showing ? yOf(scale, now.minute) : focus !== undefined ? yOf(scale, focus) : null;
    if (target !== null) box.scrollTop = Math.max(0, target - (showing ? box.clientHeight / 3 : 8));
  }, [now, showing, scale, focus]);
  return (
    <div ref={ref} aria-hidden="true" className="pointer-events-none absolute right-0 z-10" style={{ left, top: showing ? yOf(scale, now!.minute) : 0, display: showing ? undefined : "none" }}>
      <span className="absolute -left-1 -top-[5px] h-2.5 w-2.5 rounded-full bg-danger" />
      <div className="border-t-2 border-danger" />
    </div>
  );
}
