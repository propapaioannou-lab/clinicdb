"use client";

import { useEffect, useState } from "react";

const athensNow = () => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Athens", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { iso: `${p.year}-${p.month}-${p.day}`, minute: Number(p.hour) * 60 + Number(p.minute) };
};

// Red "now" line on a day timeline (moves every 30 s).
export function NowLine({ date, startHour, endHour, px, left = 0 }: { date: string; startHour: number; endHour: number; px: number; left?: number }) {
  const [now, setNow] = useState<{ iso: string; minute: number } | null>(null);
  useEffect(() => {
    const tick = () => setNow(athensNow());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);
  if (!now || now.iso !== date || now.minute < startHour * 60 || now.minute > endHour * 60) return null;
  return <div aria-hidden="true" className="pointer-events-none absolute right-0 z-10 border-t-2 border-danger" style={{ left, top: ((now.minute - startHour * 60) / 60) * px }} />;
}
