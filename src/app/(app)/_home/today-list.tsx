"use client";

import Link from "next/link";
import { Fragment, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { calColor } from "@/lib/calendar/colors";
import { StartVisitButton } from "./buttons";

export type TodayRow = {
  id: string;
  start: number;
  end: number;
  time: string;
  name: string | null;
  patientId: string | null;
  type: string;
  color: string;
  reason: string | null;
  status: string;
  room: string | null;
  visitId: string | null;
  flagged: boolean;
};

const athensMinute = () => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Athens", hourCycle: "h23", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return Number(p.hour) * 60 + Number(p.minute);
};
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const PAUSE = 30_000; // manual scroll pauses the auto-follow for 30 s

// The physician's appointments today (DESIGN 1a): a red now-line that moves with the
// clock and stays about mid-height of the list; scrolling by hand pauses that for 30 s.
export function TodayList({ rows }: { rows: TodayRow[] }) {
  const t = useTranslations("home");
  const box = useRef<HTMLDivElement>(null);
  const line = useRef<HTMLDivElement>(null);
  const manualUntil = useRef(0);
  const auto = useRef(false);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(athensMinute());
    tick();
    const id = setInterval(tick, 20_000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (!box.current || !line.current || Date.now() < manualUntil.current) return;
    auto.current = true;
    box.current.scrollTo({ top: Math.max(0, line.current.offsetTop - box.current.clientHeight / 2), behavior: "smooth" });
    setTimeout(() => (auto.current = false), 600);
  }, [now, rows.length]);

  const status = (r: TodayRow) => {
    if (r.status === "READY") return <span className="rounded-full bg-ok px-2.5 py-1 text-[12px] font-semibold text-white">{t("pill.ready")}{r.room && ` · ${r.room}`}</span>;
    if (r.status === "ARRIVED") return <span className="rounded-full bg-warn-bg px-2.5 py-1 text-[12px] font-semibold text-warn-ink">{t("pill.waiting")}</span>;
    if (r.status === "WITH_DOCTOR") return <span className="rounded-full bg-primary-tint px-2.5 py-1 text-[12px] font-semibold text-primary">{t("pill.withYou")}</span>;
    if (r.status === "TO_PAY" || r.status === "DONE") return <span className="rounded-full bg-line-softer px-2.5 py-1 text-[12px] font-semibold text-muted">{t("pill.done")}</span>;
    return <span className="rounded-full border border-line px-2.5 py-1 text-[12px] text-muted">{t("pill.expected")}</span>;
  };
  // Where the now-line goes: before the first appointment that has not ended yet.
  const lineAt = now === null ? -1 : rows.findIndex((r) => r.end > now);
  const nowLine = (
    <div ref={line} className="relative my-1 flex items-center" aria-label={t("now")}>
      <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-danger" />
      <span className="h-[2px] flex-1 bg-danger" />
      <span className="ml-2 text-[12px] font-semibold text-danger">{now !== null && hhmm(now)}</span>
    </div>
  );

  if (!rows.length) return <p className="px-5 py-8 text-center text-muted">{t("noAppointments")}</p>;
  return (
    <div ref={box} onScroll={() => { if (!auto.current) manualUntil.current = Date.now() + PAUSE; }} className="max-h-[calc(100vh-330px)] min-h-[260px] overflow-y-auto px-4 py-3">
      {rows.map((r, i) => {
        const finished = r.status === "TO_PAY" || r.status === "DONE";
        return (
          <Fragment key={r.id}>
            {i === lineAt && nowLine}
            <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line-softer py-3 last:border-0 ${finished ? "opacity-55" : ""}`}>
              <span className="w-12 text-[15px] font-semibold tabular-nums">{r.time}</span>
              <span className={`h-9 w-1.5 rounded-full ${calColor(r.color).dot}`} aria-hidden="true" />
              <span className="flex min-w-[160px] flex-1 flex-col">
                <span className="text-[15px] font-semibold">
                  {r.patientId ? <Link href={`/patients/${r.patientId}`} className="hover:underline">{r.name}</Link> : (r.name ?? r.type)}
                  {r.flagged && <span className="ml-1.5 text-danger" title={t("flagged")}>●</span>}
                </span>
                <span className="text-[13px] text-muted">{r.type}{r.reason && ` · ${r.reason}`}</span>
              </span>
              {status(r)}
              <span className="flex w-[170px] justify-end">
                {r.patientId && !finished && r.status !== "WITH_DOCTOR" && <StartVisitButton id={r.id} label={t("startVisit")} />}
                {r.patientId && r.status === "WITH_DOCTOR" && (
                  <Link href={r.visitId ? `/patients/${r.patientId}/visits/${r.visitId}` : `/patients/${r.patientId}/visits/new?appointment=${r.id}`} className="rounded-control border border-primary px-3 py-2 text-[13.5px] font-semibold text-primary">
                    {t("continueVisit")}
                  </Link>
                )}
              </span>
            </div>
          </Fragment>
        );
      })}
      {lineAt === -1 && now !== null && nowLine}
    </div>
  );
}
