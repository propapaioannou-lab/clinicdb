"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Dropdown } from "@/components/dropdown";
import { FlagDot } from "@/components/patient-bits";
import { card, ErrorBox, inputClass, primaryButton } from "@/components/ui";
import type { AppointmentStatus } from "@/generated/prisma/client";
import { calColor } from "@/lib/calendar/colors";
import type { DayAppointment, DayData } from "@/lib/calendar/day";
import { nextStatuses, STATUS_LABEL } from "@/lib/calendar/status";
import { historyAction, moveAction, statusAction, type BookingResult } from "./actions";
import { ArrivalButton } from "./arrival";
import { Anyway, Outcome } from "./booking-bits";
import { DragSurface, type ApptInfo, type Carry, type ColInfo } from "./drag-surface";
import { QuickBook, TagChips, type QuickType } from "./quick-book";
import { CardText, ColumnBackground, Folds, GridLines, Legend, place, TimeAxis } from "./grid-bits";
import { NowLine } from "./now-line";

type Panel = { kind: "default" } | { kind: "book"; resourceId: string; start: number; flex?: boolean; x?: number; y?: number } | { kind: "appointment"; id: string };

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const dmy = (iso: string) => iso.split("-").reverse().join("/");
const duration = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}ω${min % 60 ? ` ${min % 60}′` : ""}` : `${min}′`);

function AppointmentPanel({ a, data, close }: { a: DayAppointment; data: DayData; close: () => void }) {
  const t = useTranslations("calendar");
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [room, setRoom] = useState(a.room ?? data.rooms[0]);
  const [moving, setMoving] = useState(false);
  const [mv, setMv] = useState({ date: dmy(data.date), time: a.time, minutes: String(a.end - a.start), resourceId: a.resourceId });
  const [r, setR] = useState<BookingResult>({});
  const [history, setHistory] = useState<{ id: string; at: string; by: string; what: string }[]>([]);
  useEffect(() => {
    let live = true;
    historyAction(a.id).then((h) => live && setHistory(h));
    return () => {
      live = false;
    };
  }, [a.id, a.status, a.time]);
  const status = (to: AppointmentStatus, opts: { room?: string; reason?: string } = {}) =>
    start(async () => {
      const res = await statusAction(a.id, to, opts);
      setR(res);
      if (res.ok) router.refresh();
    });
  const move = (o: { flex?: boolean; override?: boolean; overrideReason?: string } = {}) =>
    start(async () => {
      const res = await moveAction(a.id, { ...mv, ...o });
      setR(res);
      if (res.ok) {
        if (res.eventId) window.dispatchEvent(new CustomEvent("clinic:moved", { detail: { id: a.id, eventId: res.eventId, label: `${mv.date} · ${mv.time}` } }));
        router.refresh();
        setMoving(false);
      }
    });
  const steps = nextStatuses(a.status as AppointmentStatus);
  const order: AppointmentStatus[] = ["BOOKED", "CONFIRMED", "ARRIVED", "READY", "WITH_DOCTOR", "TO_PAY", "DONE"];
  const forward = steps.filter((s) => order.indexOf(s) > order.indexOf(a.status as AppointmentStatus) && s !== "CANCELLED" && s !== "NO_SHOW");
  const back = steps.filter((s) => order.indexOf(s) >= 0 && order.indexOf(s) < order.indexOf(a.status as AppointmentStatus));
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col">
          <h2 className="text-[17px] font-semibold">{a.patient ? <Link href={`/patients/${a.patient.id}`} className="hover:text-primary">{a.patient.name}</Link> : t("noPatient")}</h2>
          {a.patient && <span className="text-[13px] text-muted">{a.patient.code}{a.patient.phone && <> · <a href={`tel:${a.patient.phone.replace(/\s/g, "")}`} className="text-primary">{a.patient.phone}</a></>}</span>}
        </div>
        <button type="button" onClick={close} aria-label={t("close")} className="text-muted hover:text-ink">✕</button>
      </div>
      {a.patient && a.patient.tags.length > 0 && <span className="flex flex-wrap gap-1.5"><TagChips tags={a.patient.tags} /></span>}
      <div className={`rounded-[10px] px-3 py-2 text-sm ${calColor(a.type.color).box}`}>
        <b>{a.time}–{hhmm(a.end)}</b> · {a.type.label}{a.reason && ` · ${a.reason}`}
        <div className="text-[12.5px] opacity-80">{data.columns.find((c) => c.id === a.resourceId)?.label}</div>
      </div>
      <div className="text-sm"><span className="text-muted">{t("status")}: </span><b>{STATUS_LABEL[a.status as AppointmentStatus]}</b>{a.status === "READY" && a.room && ` · ${a.room}`}{a.arrivedAt && ` · ${t("arrivedAt", { time: a.arrivedAt })}`}</div>
      <div className="flex flex-wrap gap-2">
        {forward.map((s) =>
          s === "READY" ? (
            <span key={s} className="flex items-center gap-1.5">
              <Dropdown label={t("room")} placeholder={null} value={room} onChange={(v) => v && setRoom(v)} options={data.rooms.map((r) => ({ value: r, label: r }))} className="w-[190px]" />
              <button type="button" disabled={pending} onClick={() => status("READY", { room })} className={primaryButton}>{t("actions.READY")}</button>
            </span>
          ) : s === "ARRIVED" ? (
            <ArrivalButton key={s} id={a.id} when={`${a.time} · ${a.type.label}`} label={t(`actions.${s}`)} className={primaryButton}
              patient={a.patient && { id: a.patient.id, firstName: a.patient.firstName, surname: a.patient.surname, phone: a.patient.phone, email: a.patient.email, tags: a.patient.tags }} />
          ) : (
            <button key={s} type="button" disabled={pending} onClick={() => status(s)} className={primaryButton}>{t(`actions.${s}`)}</button>
          ),
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13.5px] font-semibold">
        {a.active && a.status !== "DONE" && (
          <>
            {/* «Μετακίνηση»: the card is lifted; pick a time in any day, week or month. */}
            <button type="button" onClick={() => { const q = new URLSearchParams(params.toString()); q.set("carry", a.id); router.push(`${path}?${q}`); close(); }} className="text-primary">{t("move.label")}</button>
            <button type="button" onClick={() => setMoving((x) => !x)} className="text-primary">{t("moveManual")}</button>
          </>
        )}
        {steps.includes("NO_SHOW") && <button type="button" disabled={pending} onClick={() => status("NO_SHOW")} className="text-warn-ink">{t("actions.NO_SHOW")}</button>}
        {steps.includes("CANCELLED") && <button type="button" disabled={pending} onClick={() => { const why = prompt(t("cancelReason")); if (why !== null) status("CANCELLED", { reason: why }); }} className="text-danger">{t("actions.CANCELLED")}</button>}
        {(a.status === "CANCELLED" || a.status === "NO_SHOW") && <button type="button" disabled={pending} onClick={() => status("BOOKED")} className="text-primary">{t("restore")}</button>}
        {back.map((s) => <button key={s} type="button" disabled={pending} onClick={() => status(s)} className="text-muted">↺ {STATUS_LABEL[s]}</button>)}
      </div>
      {moving && (
        <form onSubmit={(e) => { e.preventDefault(); move(); }} className="flex flex-col gap-2 rounded-[12px] border border-line-soft bg-surface-2 p-3">
          <div className="grid grid-cols-[1fr_80px_72px] gap-2 text-sm text-ink-3">
            <label>{t("date")}<input value={mv.date} onChange={(e) => setMv({ ...mv, date: e.target.value })} className={inputClass} /></label>
            <label>{t("time")}<input value={mv.time} onChange={(e) => setMv({ ...mv, time: e.target.value })} className={inputClass} /></label>
            <label>{t("minutes")}<input value={mv.minutes} onChange={(e) => setMv({ ...mv, minutes: e.target.value.replace(/\D/g, "") })} className={inputClass} /></label>
          </div>
          <Dropdown value={mv.resourceId} onChange={(x) => x && setMv({ ...mv, resourceId: x })} label={t("with")} placeholder={null} options={data.columns.map((c) => ({ value: c.id, label: c.label }))} />
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={pending} className={primaryButton}>{t("saveMove")}</button>
            <Anyway r={r} pending={pending} go={move} label={t("moveAnyway")} />
          </div>
        </form>
      )}
      <Outcome r={r} pick={(date, time) => { setMv({ ...mv, date: dmy(date), time }); setR({}); }} />
      {r.error && r.error !== "clash" && r.error !== "reason_needed" && <ErrorBox>{t(`errors.${r.error}`)}</ErrorBox>}
      {history.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-line-softer pt-2 text-[12.5px] text-muted">
          <span className="font-semibold text-ink-3">{t("history")}</span>
          {history.map((h) => <span key={h.id}>{h.at} · {h.what} · {h.by}</span>)}
        </div>
      )}
    </div>
  );
}

// Secretary day (DESIGN 6a–6g): resource columns on the two-band grid, free gaps to click
// (white = normal hours, hatched = «εκτός ωραρίου +30′»), status chips. The calendar uses
// the full width; booking / an appointment open in a panel beside it.
export function DayView({ data, types, startAt, carry }: { data: DayData; types: QuickType[]; startAt?: { resourceId: string; start: number }; carry?: Carry | null }) {
  const t = useTranslations("calendar");
  const [panel, setPanel] = useState<Panel>(startAt ? { kind: "book", ...startAt } : { kind: "default" });
  const scale = data.scale;
  const selected = panel.kind === "appointment" ? data.appointments.find((a) => a.id === panel.id) : undefined;
  const office = scale.bands.find((b) => b.kind === "office");
  const statusChip = (a: DayAppointment) => {
    if (a.status === "READY") return <span className="rounded-full bg-primary px-2 py-0.5 text-[11.5px] font-semibold text-white">{a.room ?? t("ready")}</span>;
    if (a.status === "ARRIVED") return <span className="text-[11.5px] font-semibold">{t("arrivedAt", { time: a.arrivedAt ?? "" })}</span>;
    if (a.status === "TO_PAY") return <span className="rounded-full bg-warn-bg px-2 py-0.5 text-[11.5px] font-semibold text-warn-ink">{t("toPay")}</span>;
    if (a.status === "WITH_DOCTOR") return <span className="text-[11.5px] font-semibold">{t("withDoctor")}</span>;
    if (a.status === "DONE") return <span className="text-[11.5px]">{t("done")}</span>;
    if (a.status === "BOOKED") return <span className="rounded-full bg-warn-bg px-2 py-0.5 text-[11.5px] font-semibold text-warn-ink">? {t("unconfirmedShort")}</span>;
    if (a.status === "CONFIRMED") return <span className="text-[12px] text-ok-ink">✓</span>;
    return <span className="text-[11.5px]">{STATUS_LABEL[a.status as AppointmentStatus]}</span>;
  };
  const cols = `64px repeat(${data.columns.length}, minmax(0, 1fr))`;
  const weekday = new Date(`${data.date}T12:00:00Z`).getUTCDay() || 7;
  const open = panel.kind === "appointment" && !!selected;

  return (
    <div className="flex items-start gap-4">
      <section className={`${card} min-w-0 flex-1 overflow-hidden`}>
        {data.holiday && <div className="bg-warn-bg px-4 py-2 text-sm font-semibold text-warn-ink">{t("holiday", { name: data.holiday })}</div>}
        <div className="grid border-b border-line-soft" style={{ gridTemplateColumns: cols }}>
          <span />
          {data.columns.map((c) => (
            <div key={c.id} className="flex items-baseline justify-between gap-2 border-l border-line-soft px-3 py-2">
              <span className="truncate text-[15px] font-semibold">{c.label}</span>
              <span className="shrink-0 text-[12.5px] text-muted">
                {data.appointments.some((a) => a.resourceId === c.id && a.parked) && <b className="mr-2 text-cal-blue">⤓ {t("parkedCount", { count: data.appointments.filter((a) => a.resourceId === c.id && a.parked).length })}</b>}
                {t("columnSummary", { surgeries: c.surgeries, count: c.count, free: c.hours.length ? duration(c.freeMinutes) : "—" })}
              </span>
            </div>
          ))}
        </div>
        <div className="max-h-[calc(100vh-250px)] min-h-[420px] overflow-y-auto">
          <DragSurface scale={scale} carry={carry} className="relative grid" style={{ gridTemplateColumns: cols, height: scale.height }}>
            <TimeAxis scale={scale} labels={{ surgery: t("bands.surgery"), office: t("bands.office") }} />
            {data.columns.map((c) => (
              <div key={c.id} className="relative border-l border-line-soft" data-col={JSON.stringify({ date: data.date, resourceId: c.id, weekday, normal: c.hours, flex: c.flex } satisfies ColInfo)}>
                <ColumnBackground scale={scale} surgery={c.surgery} hours={c.hours} flex={c.flex} labels={{ overrun: t("overrun", { time: "{time}" }), flex: t("flexLabel") }} />
                <GridLines scale={scale} />
                {c.blocks.map((b) => (
                  <div key={b.id} className="absolute left-1 right-1 overflow-hidden rounded-[8px] bg-[repeating-linear-gradient(45deg,var(--color-line-softer)_0_6px,var(--color-line)_6px_8px)] px-2 py-1 text-[12px] text-ink-3" style={place(scale, b.start, b.end)}>
                    {b.label ?? t(`blockKinds.${b.kind}`)} · {hhmm(b.start)}–{hhmm(b.end)}
                  </div>
                ))}
                {c.gaps.map((g) => (
                  <button key={g.start} type="button" onClick={(e) => setPanel({ kind: "book", resourceId: c.id, start: g.start, x: e.clientX, y: e.clientY })}
                    className="absolute left-1 right-1 flex items-start rounded-[8px] border border-dashed border-ok/60 bg-ok-bg/40 px-2 py-0.5 text-left text-[12.5px] font-semibold text-ok-ink hover:bg-ok-bg"
                    style={place(scale, g.start, g.end)}>
                    + {t("free", { minutes: duration(g.end - g.start) })}
                  </button>
                ))}
                {c.flexGaps.map((g) => (
                  <button key={`f${g.start}`} type="button" onClick={(e) => setPanel({ kind: "book", resourceId: c.id, start: g.start, flex: true, x: e.clientX, y: e.clientY })}
                    title={t("flexNote")}
                    className="absolute left-1 right-1 flex items-start rounded-[8px] border border-dashed border-transparent px-2 py-0.5 text-left text-[11.5px] font-semibold text-transparent hover:border-line-strong hover:bg-surface/80 hover:text-muted focus-visible:text-muted"
                    style={place(scale, g.start, g.end)}>
                    + {t("flexSlot")}
                  </button>
                ))}
                {data.appointments.filter((a) => a.resourceId === c.id).map((a) => {
                  const box = place(scale, a.start, a.end);
                  const tight = box.height < 34 || !a.active;
                  // Surgeries move with Phase 4/6b; done ones stay where they were.
                  const movable = a.active && a.status !== "DONE" && a.type.layer !== "SURGERY";
                  return (
                    <button key={a.id} type="button" onClick={() => setPanel({ kind: "appointment", id: a.id })}
                      data-appt={JSON.stringify({ id: a.id, date: data.date, resourceId: a.resourceId, start: a.start, end: a.end, active: a.active, movable, label: `${a.patient?.short ?? a.type.label} · ${a.type.label} ${a.end - a.start}′` } satisfies ApptInfo)}
                      // Cancelled / no-show: a small chip on the right, so the freed time stays clickable.
                      className={`absolute ${a.parked ? "left-[22%]" : a.active ? "left-1" : "left-auto w-[40%] min-w-[120px]"} right-1 flex justify-between gap-2 overflow-hidden rounded-[7px] px-2 text-left shadow-[0_1px_2px_rgba(0,0,0,0.06)] ${tight ? "items-center text-[12px] leading-none" : "items-start py-1 text-[13px]"} ${calColor(a.type.color).box} ${!a.active ? "line-through opacity-50" : a.status === "DONE" ? "opacity-60" : ""} ${panel.kind === "appointment" && panel.id === a.id ? "ring-2 ring-primary" : ""} ${movable ? "cursor-grab touch-none active:cursor-grabbing" : ""} ${a.parked ? "outline-dashed outline-2 outline-offset-1 outline-cal-blue shadow-[0_10px_24px_rgba(28,32,36,0.28)]" : ""}`}
                      style={{ ...box, zIndex: a.parked ? 4 : a.active ? 2 : 3 }}>
                      <CardText h={a.active ? box.height : 0} time={a.time} end={a.end} name={a.patient?.short ?? t("noPatient")} type={a.type.label} reason={a.reason} surgery={a.type.layer === "SURGERY"}
                        extra={<>
                          {a.patient && a.patient.flag !== "NONE" && <span className="ml-1 inline-block align-middle"><FlagDot flag={a.patient.flag as "YELLOW" | "RED"} label={t("flagged")} /></span>}
                          {a.patient && a.patient.tags.length > 0 && <span className="ml-1.5 inline-flex gap-1 align-middle font-normal"><TagChips tags={a.patient.tags} /></span>}
                        </>} />
                      <span className="flex shrink-0 items-center gap-1">
                        {a.parked && <span title={t("parkedHint")} className="rounded-full bg-cal-blue px-2 py-0.5 text-[11px] font-semibold text-white">⤓ {t("parked")}</span>}
                        {statusChip(a)}
                      </span>
                      {movable && <span data-resize aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize" />}
                    </button>
                  );
                })}
              </div>
            ))}
            <Folds scale={scale} left={64} label={t("folded")} />
            <NowLine dates={[data.date]} scale={scale} left={64} focus={office?.from} />
          </DragSurface>
        </div>
        <Legend types={[...types.map((ty) => ({ label: ty.label, minutes: ty.minutes, color: ty.color })), { label: t("surgery"), minutes: 0, color: "blue" }]} zones={{ flex: t("legend.flex"), closed: t("legend.closedShort") }} />
      </section>

      {panel.kind === "book" && <QuickBook key={`${panel.resourceId}${panel.start}`} data={data} types={types} at={panel} close={() => setPanel({ kind: "default" })} />}
      {open && (
        <aside className={`${card} sticky top-[88px] flex max-h-[calc(100vh-110px)] w-[380px] shrink-0 flex-col gap-4 overflow-y-auto p-5 max-lg:fixed max-lg:inset-x-3 max-lg:bottom-3 max-lg:top-auto max-lg:z-40 max-lg:w-auto max-lg:shadow-[0_12px_40px_rgba(28,32,36,0.25)]`}>
          {panel.kind === "appointment" && selected && <AppointmentPanel key={selected.id} a={selected} data={data} close={() => setPanel({ kind: "default" })} />}
        </aside>
      )}
    </div>
  );
}
