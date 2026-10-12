"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

const parts = () => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Athens", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { iso: `${p.year}-${p.month}-${p.day}`, hms: `${p.hour}:${p.minute}:${p.second}`, minute: Number(p.hour) * 60 + Number(p.minute), second: Number(p.second) };
};

// Live clock with seconds (DESIGN 1a, top left) and the countdown to the next patient:
// amber within 5 minutes, red "αργεί X′" once the time has passed.
export function LiveClock({ date, nextStart }: { date: string; nextStart: number | null }) {
  const t = useTranslations("home");
  const [now, setNow] = useState<ReturnType<typeof parts> | null>(null);
  useEffect(() => {
    const tick = () => setNow(parts());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  if (!now) return <span className="text-[30px] font-semibold tabular-nums text-muted">--:--:--</span>;
  const left = nextStart !== null && now.iso === date ? nextStart - now.minute - (now.second ? 1 : 0) : null;
  return (
    <span className="flex flex-col">
      <span className="text-[30px] font-semibold leading-none tabular-nums">{now.hms}</span>
      {left !== null && (
        <span className={`mt-1 text-[13px] font-semibold ${left < 0 ? "text-danger" : left <= 5 ? "text-warn-ink" : "text-muted"}`}>
          {left < 0 ? t("late", { minutes: -left }) : left === 0 ? t("nextNow") : t("nextIn", { minutes: left })}
        </span>
      )}
    </span>
  );
}
