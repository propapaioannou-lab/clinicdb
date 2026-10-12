"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Dropdown } from "@/components/dropdown";
import { FlagDot } from "@/components/patient-bits";
import { card, ErrorBox, inputClass, Notice, primaryButton, secondaryButton } from "@/components/ui";
import type { AppointmentStatus } from "@/generated/prisma/client";
import { calColor } from "@/lib/calendar/colors";
import type { DayAppointment, DayData } from "@/lib/calendar/day";
import { nextStatuses, STATUS_LABEL } from "@/lib/calendar/status";
import { bookAction, historyAction, moveAction, statusAction, type BookingResult } from "./actions";

const PX = 96; // pixels per hour (DESIGN §6 day view: room for 15′ appointments)
type Type = { id: string; label: string; minutes: number; color: string };
type Panel = { kind: "default" } | { kind: "book"; resourceId?: string; start?: number; minutes?: number } | { kind: "appointment"; id: string };

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const dmy = (iso: string) => iso.split("-").reverse().join("/");
const duration = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}ω${min % 60 ? ` ${min % 60}′` : ""}` : `${min}′`);
const athensNow = () => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Athens", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { iso: `${p.year}-${p.month}-${p.day}`, minute: Number(p.hour) * 60 + Number(p.minute) };
};

// Clash warnings and suggested free times, shared by booking and moving.
function Outcome({ r, pick }: { r: BookingResult; pick: (date: string, time: string) => void }) {
  const t = useTranslations("calendar");
  if (r.ok && r.warned?.length) return <Notice>{t("bookedDespite", { list: r.warned.join(" · ") })}</Notice>;
  if (!r.error) return null;
  return (
    <div className="flex flex-col gap-2 rounded-[10px] border border-warn-line bg-warn-bg/60 px-3 py-2.5 text-sm text-warn-ink">
      <span className="font-semibold">{r.error === "clash" ? t("clash") : t(`errors.${r.error}`)}</span>
      {r.problems?.map((p) => <span key={p}>• {p}</span>)}
      {!!r.suggestions?.length && (
        <div className="flex flex-col gap-1.5">
          <span className="text-ink-3">{t("suggestions")}</span>
          <div className="flex flex-wrap gap-1.5">
            {r.suggestions.map((s) => (
              <button key={s.date + s.time} type="button" onClick={() => pick(s.date, s.time)} className="min-h-9 rounded-full border border-ok bg-ok-bg px-3 text-[13px] font-semibold text-ok-ink">{s.label}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

type Found = { id: string; code: string; name: string; phone: string | null; age: number | null };

function PatientPicker({ value, onChange }: { value: Found | null; onChange: (p: Found | null) => void }) {
  const t = useTranslations("calendar");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Found[]>([]);
  useEffect(() => {
    if (q.trim().length < 2) return;
    const ctrl = new AbortController();
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/patients/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        if (res.ok) setResults(((await res.json()).results as Found[]).slice(0, 6));
      } catch {}
    }, 180);
    return () => {
      clearTimeout(id);
      ctrl.abort();
    };
  }, [q]);
  if (value)
    return (
      <div className="flex items-center justify-between gap-2 rounded-control border border-primary bg-primary-tint px-3 py-2 text-sm">
        <span><b>{value.name}</b> <span className="text-muted">· {value.code}{value.phone && ` · ${value.phone}`}</span></span>
        <button type="button" onClick={() => onChange(null)} aria-label={t("changePatient")} className="text-muted hover:text-danger">✕</button>
      </div>
    );
  return (
    <div className="relative">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchPatient")} aria-label={t("patient")} className={inputClass} />
      {q.trim().length >= 2 && results.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-40 mt-1.5 overflow-hidden rounded-[14px] border border-line bg-surface py-1 text-sm shadow-[0_8px_24px_rgba(28,32,36,0.12)]">
          {results.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => { onChange(p); setQ(""); }} className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-primary-tint">
                <span className="font-semibold">{p.name}</span>
                <span className="text-[12.5px] text-muted">{[p.code, p.age !== null && `${p.age} ετών`, p.phone].filter(Boolean).join(" · ")}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <Link href="/patients/new" target="_blank" className="mt-1 inline-block text-[13px] font-semibold text-primary">+ {t("newPatient")}</Link>
    </div>
  );
}

function BookingPanel({ data, types, initial, close }: { data: DayData; types: Type[]; initial: Extract<Panel, { kind: "book" }>; close: () => void }) {
  const t = useTranslations("calendar");
  const router = useRouter();
  const [pending, start] = useTransition();
  const firstType = types[0];
  const [v, setV] = useState({
    patient: null as Found | null,
    typeId: firstType?.id ?? "",
    date: dmy(data.date),
    time: initial.start !== undefined ? hhmm(initial.start) : "",
    minutes: String(firstType?.minutes ?? 30),
    resourceId: initial.resourceId ?? data.columns[0]?.id ?? "",
    reason: "",
  });
  const [r, setR] = useState<BookingResult>({});
  const set = (p: Partial<typeof v>) => setV((x) => ({ ...x, ...p }));
  const submit = (override = false) =>
    start(async () => {
      const res = await bookAction({ patientId: v.patient?.id ?? null, typeId: v.typeId, resourceId: v.resourceId, date: v.date, time: v.time, minutes: v.minutes, reason: v.reason, override });
      setR(res);
      if (res.ok) {
        router.refresh();
        if (!res.warned?.length) close();
      }
    });
  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="flex flex-col gap-3">
      <div className="flex items-center justify-between"><h2 className="text-[17px] font-semibold">{t("newAppointment")}</h2><button type="button" onClick={close} aria-label={t("close")} className="text-muted hover:text-ink">✕</button></div>
      <div className="text-sm text-ink-3">{t("patient")}<div className="mt-1"><PatientPicker value={v.patient} onChange={(patient) => set({ patient })} /></div></div>
      <div className="flex flex-col gap-1.5 text-sm text-ink-3">{t("type")}
        <div className="flex flex-wrap gap-1.5">
          {types.map((ty) => (
            <button key={ty.id} type="button" aria-pressed={v.typeId === ty.id} onClick={() => set({ typeId: ty.id, minutes: String(ty.minutes) })}
              className={`min-h-9 rounded-full border px-3 text-[13px] ${v.typeId === ty.id ? "border-primary bg-primary-tint font-semibold text-primary" : "border-line-strong text-ink-2"}`}>
              <span className={`mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle ${calColor(ty.color).dot}`} />{ty.label} · {ty.minutes}′
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-[1fr_88px_80px] gap-2 text-sm text-ink-3">
        <label>{t("date")}<input value={v.date} onChange={(e) => set({ date: e.target.value })} placeholder="ΗΗ/ΜΜ/ΕΕΕΕ" inputMode="numeric" className={inputClass} /></label>
        <label>{t("time")}<input value={v.time} onChange={(e) => set({ time: e.target.value })} placeholder="ΩΩ:ΛΛ" inputMode="numeric" className={inputClass} /></label>
        <label>{t("minutes")}<input value={v.minutes} onChange={(e) => set({ minutes: e.target.value.replace(/\D/g, "") })} inputMode="numeric" className={inputClass} /></label>
      </div>
      <label className="text-sm text-ink-3">{t("with")}
        <Dropdown value={v.resourceId} onChange={(x) => x && set({ resourceId: x })} label={t("with")} placeholder={null} options={data.columns.map((c) => ({ value: c.id, label: c.label }))} className="mt-1" />
      </label>
      <label className="text-sm text-ink-3">{t("reason")}<input value={v.reason} onChange={(e) => set({ reason: e.target.value })} placeholder={t("reasonHint")} className={inputClass} /></label>
      <div className="flex flex-col gap-1 rounded-[10px] bg-surface-2 px-3 py-2 text-[13px] text-muted">
        {["whatsapp", "reminder", "intake", "deposit"].map((k) => <span key={k}>☐ {t(`switches.${k}`)} · {t("soonGhl")}</span>)}
      </div>
      <Outcome r={r} pick={(date, time) => { set({ date: dmy(date), time }); setR({}); }} />
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending || !v.time} className={primaryButton}>{t("book")}</button>
        {r.error === "clash" && <button type="button" disabled={pending} onClick={() => submit(true)} className={secondaryButton}>{t("bookAnyway")}</button>}
      </div>
    </form>
  );
}

function AppointmentPanel({ a, data, close }: { a: DayAppointment; data: DayData; close: () => void }) {
  const t = useTranslations("calendar");
  const router = useRouter();
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
  const move = (override = false) =>
    start(async () => {
      const res = await moveAction(a.id, { ...mv, override });
      setR(res);
      if (res.ok) {
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
          ) : (
            <button key={s} type="button" disabled={pending} onClick={() => status(s)} className={primaryButton}>{t(`actions.${s}`)}</button>
          ),
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13.5px] font-semibold">
        {a.active && a.status !== "DONE" && <button type="button" onClick={() => setMoving((x) => !x)} className="text-primary">{t("move")}</button>}
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
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className={primaryButton}>{t("saveMove")}</button>
            {r.error === "clash" && <button type="button" disabled={pending} onClick={() => move(true)} className={secondaryButton}>{t("moveAnyway")}</button>}
          </div>
        </form>
      )}
      <Outcome r={r} pick={(date, time) => { setMv({ ...mv, date: dmy(date), time }); setR({}); }} />
      {r.error && r.error !== "clash" && <ErrorBox>{t(`errors.${r.error}`)}</ErrorBox>}
      {history.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-line-softer pt-2 text-[12.5px] text-muted">
          <span className="font-semibold text-ink-3">{t("history")}</span>
          {history.map((h) => <span key={h.id}>{h.at} · {h.what} · {h.by}</span>)}
        </div>
      )}
    </div>
  );
}

// Secretary day (DESIGN 6a–6f): resource columns, free gaps to click, status chips; side
// panel for booking, an appointment, or (default) booking requests + tomorrow.
export function DayView({ data, types, todayIso, startBooking = false }: { data: DayData; types: Type[]; todayIso: string; startBooking?: boolean }) {
  const t = useTranslations("calendar");
  const [panel, setPanel] = useState<Panel>(startBooking ? { kind: "book" } : { kind: "default" });
  const [now, setNow] = useState<{ iso: string; minute: number } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const tick = () => setNow(athensNow());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);
  const top = (min: number) => ((min - data.startHour * 60) / 60) * PX;
  const height = (data.endHour - data.startHour) * PX;
  const selected = panel.kind === "appointment" ? data.appointments.find((a) => a.id === panel.id) : undefined;
  const statusChip = (a: DayAppointment) => {
    if (a.status === "READY") return <span className="rounded-full bg-primary px-2 py-0.5 text-[11.5px] font-semibold text-white">{a.room ?? t("ready")}</span>;
    if (a.status === "ARRIVED") return <span className="text-[11.5px] font-semibold">{t("arrivedAt", { time: a.arrivedAt ?? "" })}</span>;
    if (a.status === "TO_PAY") return <span className="rounded-full bg-warn-bg px-2 py-0.5 text-[11.5px] font-semibold text-warn-ink">{t("toPay")}</span>;
    if (a.status === "WITH_DOCTOR") return <span className="text-[11.5px] font-semibold">{t("withDoctor")}</span>;
    if (a.status === "DONE") return <span className="text-[11.5px]">{t("done")}</span>;
    if (a.status === "BOOKED") return <span className="rounded-full bg-warn-bg px-2 py-0.5 text-[11.5px] font-semibold text-warn-ink">? {t("unconfirmed")}</span>;
    if (a.status === "CONFIRMED") return <span className="text-[12px] text-ok-ink">✓</span>;
    return <span className="text-[11.5px]">{STATUS_LABEL[a.status as AppointmentStatus]}</span>;
  };

  return (
    <div className="flex flex-wrap items-start gap-5">
      <section className={`${card} min-w-0 flex-[999_1_620px] overflow-hidden`}>
        {data.holiday && <div className="bg-warn-bg px-4 py-2 text-sm font-semibold text-warn-ink">{t("holiday", { name: data.holiday })}</div>}
        <div className="grid border-b border-line-soft" style={{ gridTemplateColumns: `56px repeat(${data.columns.length}, minmax(0, 1fr))` }}>
          <span />
          {data.columns.map((c) => (
            <div key={c.id} className="border-l border-line-soft px-3 py-2">
              <div className="text-[15px] font-semibold">{c.label}</div>
              <div className="text-[12.5px] text-muted">{t("columnSummary", { count: c.count, free: duration(c.freeMinutes) })}</div>
            </div>
          ))}
        </div>
        <div ref={scroller} className="max-h-[calc(100vh-230px)] overflow-y-auto">
          <div className="relative grid" style={{ gridTemplateColumns: `56px repeat(${data.columns.length}, minmax(0, 1fr))`, height }}>
            <div className="relative">
              {Array.from({ length: data.endHour - data.startHour }, (_, i) => (
                <span key={i} className="absolute right-2 text-[12px] text-muted" style={{ top: i * PX - 7 }}>{hhmm((data.startHour + i) * 60)}</span>
              ))}
            </div>
            {data.columns.map((c) => (
              <div key={c.id} className="relative border-l border-line-soft bg-[repeating-linear-gradient(0deg,transparent_0_95px,var(--color-line-softer)_95px_96px)]">
                {/* Out of hours: grey; working hours: white. */}
                <div className="absolute inset-0 bg-line-softer/60" />
                {c.hours.map((h) => <div key={h.from} className="absolute left-0 right-0 bg-surface" style={{ top: top(h.from), height: top(h.to) - top(h.from) }} />)}
                {c.blocks.map((b) => (
                  <div key={b.id} className="absolute left-1 right-1 overflow-hidden rounded-[8px] bg-[repeating-linear-gradient(45deg,var(--color-line-softer)_0_6px,var(--color-line)_6px_8px)] px-2 py-1 text-[12px] text-ink-3" style={{ top: top(b.start), height: top(b.end) - top(b.start) }}>
                    {b.label ?? t(`blockKinds.${b.kind}`)} · {hhmm(b.start)}–{hhmm(b.end)}
                  </div>
                ))}
                {c.gaps.map((g) => (
                  <button key={g.start} type="button" onClick={() => setPanel({ kind: "book", resourceId: c.id, start: g.start })}
                    className="absolute left-1 right-1 flex items-start rounded-[8px] border border-dashed border-ok/60 bg-ok-bg/40 px-2 py-1 text-left text-[12.5px] font-semibold text-ok-ink hover:bg-ok-bg"
                    style={{ top: top(g.start) + 1, height: top(g.end) - top(g.start) - 2 }}>
                    + {t("free", { minutes: duration(g.end - g.start) })}
                  </button>
                ))}
                {data.appointments.filter((a) => a.resourceId === c.id).map((a) => (
                  <button key={a.id} type="button" onClick={() => setPanel({ kind: "appointment", id: a.id })}
                    className={`absolute left-1 right-1 flex items-start justify-between gap-2 overflow-hidden rounded-[8px] px-2 py-1 text-left text-[13px] shadow-[0_1px_2px_rgba(0,0,0,0.06)] ${calColor(a.type.color).box} ${!a.active ? "line-through opacity-50" : a.status === "DONE" ? "opacity-60" : ""} ${panel.kind === "appointment" && panel.id === a.id ? "ring-2 ring-primary" : ""}`}
                    style={{ top: top(a.start) + 1, height: Math.max(24, top(a.end) - top(a.start) - 2), zIndex: 2 }}>
                    <span className="min-w-0 truncate">
                      <b>{a.time}</b> <b>{a.patient?.short ?? t("noPatient")}</b>{a.patient && a.patient.flag !== "NONE" && <span className="ml-1 inline-block align-middle"><FlagDot flag={a.patient.flag as "YELLOW" | "RED"} label={t("flagged")} /></span>} <span className="opacity-80">· {a.type.label}{a.reason && ` · ${a.reason}`}</span>
                    </span>
                    <span className="shrink-0">{statusChip(a)}</span>
                  </button>
                ))}
              </div>
            ))}
            {now && now.iso === data.date && now.minute >= data.startHour * 60 && now.minute <= data.endHour * 60 && (
              <div aria-hidden="true" className="pointer-events-none absolute left-[56px] right-0 z-10 border-t-2 border-danger" style={{ top: top(now.minute) }} />
            )}
          </div>
        </div>
      </section>

      <aside className={`${card} flex min-w-0 flex-[1_1_340px] flex-col gap-4 p-5`}>
        {panel.kind === "book" && <BookingPanel key={`${panel.resourceId}${panel.start}`} data={data} types={types} initial={panel} close={() => setPanel({ kind: "default" })} />}
        {panel.kind === "appointment" && selected && <AppointmentPanel key={selected.id} a={selected} data={data} close={() => setPanel({ kind: "default" })} />}
        {(panel.kind === "default" || (panel.kind === "appointment" && !selected)) && (
          <>
            <div className="flex flex-col gap-1.5">
              <h2 className="text-[17px] font-semibold">{t("requests")}</h2>
              <p className="text-sm text-muted">{t("requestsSoon")}</p>
            </div>
            <div className="flex flex-col gap-1.5 border-t border-line-softer pt-4">
              <h2 className="text-[17px] font-semibold">{t("tomorrow")}</h2>
              <p className="text-sm">{t("tomorrowConfirmed", { confirmed: data.tomorrow.confirmed, total: data.tomorrow.total })}</p>
              {data.tomorrow.total > 0 && (
                <div className="h-2 overflow-hidden rounded-full bg-line-softer"><div className="h-full bg-ok" style={{ width: `${(100 * data.tomorrow.confirmed) / data.tomorrow.total}%` }} /></div>
              )}
            </div>
            {data.date !== todayIso && <p className="text-[13px] text-muted">{t("otherDay")}</p>}
          </>
        )}
      </aside>
    </div>
  );
}
