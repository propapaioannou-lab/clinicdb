"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { inputClass, primaryButton } from "@/components/ui";
import type { BookingPatient } from "@/lib/calendar/quick";
import type { WaitlistRow } from "@/lib/calendar/waitlist";
import { bookingSearchAction, waitlistAddAction, waitlistRemoveAction } from "./actions";

const DAYS = [1, 2, 3, 4, 5];
const dmy = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

// «Λίστα αναμονής» (the top-strip tile): who is waiting, for what, when; add and take off.
export function WaitlistPanel({ rows, types }: { rows: WaitlistRow[]; types: { id: string; label: string; minutes: number }[] }) {
  const t = useTranslations("calendar.waitlist");
  const tw = useTranslations("calendar.weekdays");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [q, setQ] = useState("");
  const [found, setFound] = useState<BookingPatient[]>([]);
  const [v, setV] = useState({ patient: null as BookingPatient | null, typeId: "", days: [] as number[], fromTime: "", toTime: "", note: "" });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (v.patient || q.trim().length < 2) return;
    let live = true;
    const id = setTimeout(() => bookingSearchAction(q).then((x) => live && setFound(x)), 220);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [q, v.patient]);

  const add = () =>
    start(async () => {
      const r = await waitlistAddAction({ patientId: v.patient?.id, typeId: v.typeId || undefined, days: v.days, fromTime: v.fromTime || undefined, toTime: v.toTime || undefined, note: v.note });
      if (r.error) return setError(t("error"));
      setError(null);
      setV({ patient: null, typeId: "", days: [], fromTime: "", toTime: "", note: "" });
      setQ("");
      router.refresh();
    });
  const when = (r: WaitlistRow) =>
    [r.days.length ? r.days.map((d) => tw(String(d) as "1")).join(", ") : t("anyDay"), r.fromTime || r.toTime ? `${r.fromTime ?? "…"}–${r.toTime ?? "…"}` : null].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-col gap-3">
      {rows.length ? (
        <ul className="flex flex-col divide-y divide-line-softer">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 py-1.5">
              <b>{r.name}</b>
              <span className="text-ink-3">{r.type ?? t("anyType")}{r.minutes && ` ${r.minutes}′`} · {when(r)}</span>
              {r.note && <span className="text-muted">· {r.note}</span>}
              <span className="text-[12px] text-muted">{t("since", { date: dmy(r.since) })}</span>
              <button type="button" disabled={pending} onClick={() => start(async () => { await waitlistRemoveAction(r.id, "removed"); router.refresh(); })}
                className="ml-auto text-[13px] font-semibold text-muted hover:text-danger">{t("remove")}</button>
            </li>
          ))}
        </ul>
      ) : <p className="text-muted">{t("empty")}</p>}

      <div className="flex flex-col gap-2 rounded-[10px] bg-surface-2 p-3">
        <b className="text-[13.5px]">{t("add")}</b>
        {v.patient ? (
          <span className="flex items-center gap-2"><b>{v.patient.name}</b><button type="button" onClick={() => setV({ ...v, patient: null })} className="text-[12.5px] font-semibold text-primary">{t("change")}</button></span>
        ) : (
          <div>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} className={`${inputClass} mt-0`} />
            {q.trim().length >= 2 && found.length > 0 && (
              <ul className="mt-1 overflow-hidden rounded-[8px] border border-line-soft bg-surface">
                {found.map((p) => <li key={p.id}><button type="button" onClick={() => setV({ ...v, patient: p })} className="w-full px-3 py-1.5 text-left hover:bg-primary-tint"><b>{p.name}</b> <span className="text-[12px] text-muted">{p.phone}</span></button></li>)}
              </ul>
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-1.5">
          {types.map((ty) => (
            <button key={ty.id} type="button" aria-pressed={v.typeId === ty.id} onClick={() => setV({ ...v, typeId: v.typeId === ty.id ? "" : ty.id })}
              className={`min-h-8 rounded-full border px-2.5 text-[12.5px] ${v.typeId === ty.id ? "border-primary bg-primary font-semibold text-white" : "border-line-strong"}`}>{ty.label} {ty.minutes}′</button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
          {DAYS.map((d) => (
            <button key={d} type="button" aria-pressed={v.days.includes(d)} onClick={() => setV({ ...v, days: v.days.includes(d) ? v.days.filter((x) => x !== d) : [...v.days, d] })}
              className={`min-h-8 rounded-full border px-2.5 ${v.days.includes(d) ? "border-primary bg-primary-tint font-semibold text-primary" : "border-line-strong"}`}>{tw(String(d) as "1")}</button>
          ))}
          <input value={v.fromTime} onChange={(e) => setV({ ...v, fromTime: e.target.value })} placeholder={t("from")} aria-label={t("from")} className={`${inputClass} mt-0 h-8 w-[78px] text-center`} />–
          <input value={v.toTime} onChange={(e) => setV({ ...v, toTime: e.target.value })} placeholder={t("to")} aria-label={t("to")} className={`${inputClass} mt-0 h-8 w-[78px] text-center`} />
        </div>
        <input value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} placeholder={t("note")} className={`${inputClass} mt-0`} />
        {error && <p role="alert" className="text-[13px] text-danger-ink">{error}</p>}
        <button type="button" disabled={pending || !v.patient} onClick={add} className={`${primaryButton} min-h-9 self-start`}>{t("addButton")}</button>
      </div>
    </div>
  );
}
