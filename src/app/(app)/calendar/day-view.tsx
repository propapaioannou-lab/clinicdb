"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Dropdown } from "@/components/dropdown";
import { FlagDot } from "@/components/patient-bits";
import { card, ErrorBox, inputClass, Notice, primaryButton, secondaryButton } from "@/components/ui";
import type { AppointmentStatus } from "@/generated/prisma/client";
import { calColor } from "@/lib/calendar/colors";
import type { DayAppointment, DayData } from "@/lib/calendar/day";
import { nextStatuses, STATUS_LABEL } from "@/lib/calendar/status";
import { bookAction, historyAction, moveAction, statusAction, type BookingResult } from "./actions";
import { ColumnBackground, Folds, GridLines, place, TimeAxis } from "./grid-bits";
import { NowLine } from "./now-line";

type Type = { id: string; label: string; minutes: number; color: string };
type Panel = { kind: "default" } | { kind: "book"; resourceId?: string; start?: number; minutes?: number; flex?: boolean } | { kind: "appointment"; id: string };

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const dmy = (iso: string) => iso.split("-").reverse().join("/");
const duration = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}ω${min % 60 ? ` ${min % 60}′` : ""}` : `${min}′`);

// Booking anyway (SPEC §4c hours): a flex zone takes one more click; off-hours and
// weekends need a written reason (kept in the log); a clash just a second click.
function Anyway({ r, pending, go, label }: { r: BookingResult; pending: boolean; go: (o: { flex?: boolean; override?: boolean; overrideReason?: string }) => void; label: string }) {
  const t = useTranslations("calendar");
  const [why, setWhy] = useState("");
  if (r.error === "clash" && r.flexOnly) return <button type="button" disabled={pending} onClick={() => go({ flex: true })} className={secondaryButton}>{t("bookFlex")}</button>;
  if (r.needsReason && (r.error === "clash" || r.error === "reason_needed"))
    return (
      <span className="flex w-full flex-col gap-1.5 text-sm text-ink-3">
        {t("overrideReason")}
        <input value={why} onChange={(e) => setWhy(e.target.value)} placeholder={t("overrideHint")} aria-label={t("overrideReason")} className={`${inputClass} mt-0`} />
        <button type="button" disabled={pending || !why.trim()} onClick={() => go({ override: true, overrideReason: why })} className={`${secondaryButton} self-start`}>{label}</button>
      </span>
    );
  if (r.error === "clash") return <button type="button" disabled={pending} onClick={() => go({ override: true })} className={secondaryButton}>{label}</button>;
  return null;
}

// Clash warnings and suggested free times, shared by booking and moving.
function Outcome({ r, pick }: { r: BookingResult; pick: (date: string, time: string) => void }) {
  const t = useTranslations("calendar");
  if (r.ok && r.warned?.length) return <Notice>{t("bookedDespite", { list: r.warned.join(" · ") })}</Notice>;
  if (!r.error) return null;
  return (
    <div className="flex flex-col gap-2 rounded-[10px] border border-warn-line bg-warn-bg/60 px-3 py-2.5 text-sm text-warn-ink">
      <span className="font-semibold">{r.error === "clash" ? (r.flexOnly ? t("flexZone") : t("clash")) : t(`errors.${r.error}`)}</span>
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
  const submit = (o: { flex?: boolean; override?: boolean; overrideReason?: string } = {}) =>
    start(async () => {
      const res = await bookAction({ patientId: v.patient?.id ?? null, typeId: v.typeId, resourceId: v.resourceId, date: v.date, time: v.time, minutes: v.minutes, reason: v.reason, flex: initial.flex, ...o });
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
      {initial.flex && <p className="rounded-[10px] bg-surface-2 px-3 py-2 text-[13px] text-ink-3">{t("flexNote")}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending || !v.time} className={primaryButton}>{t("book")}</button>
        <Anyway r={r} pending={pending} go={submit} label={t("bookAnyway")} />
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
  const move = (o: { flex?: boolean; override?: boolean; overrideReason?: string } = {}) =>
    start(async () => {
      const res = await moveAction(a.id, { ...mv, ...o });
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
export function DayView({ data, types, startBooking = false }: { data: DayData; types: Type[]; startBooking?: boolean }) {
  const t = useTranslations("calendar");
  const [panel, setPanel] = useState<Panel>(startBooking ? { kind: "book" } : { kind: "default" });
  const scale = data.scale;
  const selected = panel.kind === "appointment" ? data.appointments.find((a) => a.id === panel.id) : undefined;
  const office = scale.bands.find((b) => b.kind === "office");
  const statusChip = (a: DayAppointment) => {
    if (a.status === "READY") return <span className="rounded-full bg-primary px-2 py-0.5 text-[11.5px] font-semibold text-white">{a.room ?? t("ready")}</span>;
    if (a.status === "ARRIVED") return <span className="text-[11.5px] font-semibold">{t("arrivedAt", { time: a.arrivedAt ?? "" })}</span>;
    if (a.status === "TO_PAY") return <span className="rounded-full bg-warn-bg px-2 py-0.5 text-[11.5px] font-semibold text-warn-ink">{t("toPay")}</span>;
    if (a.status === "WITH_DOCTOR") return <span className="text-[11.5px] font-semibold">{t("withDoctor")}</span>;
    if (a.status === "DONE") return <span className="text-[11.5px]">{t("done")}</span>;
    if (a.status === "BOOKED") return <span className="rounded-full bg-warn-bg px-2 py-0.5 text-[11.5px] font-semibold text-warn-ink">?</span>;
    if (a.status === "CONFIRMED") return <span className="text-[12px] text-ok-ink">✓</span>;
    return <span className="text-[11.5px]">{STATUS_LABEL[a.status as AppointmentStatus]}</span>;
  };
  const cols = `56px repeat(${data.columns.length}, minmax(0, 1fr))`;
  const open = panel.kind === "book" || (panel.kind === "appointment" && !!selected);

  return (
    <div className="flex items-start gap-4">
      <section className={`${card} min-w-0 flex-1 overflow-hidden`}>
        {data.holiday && <div className="bg-warn-bg px-4 py-2 text-sm font-semibold text-warn-ink">{t("holiday", { name: data.holiday })}</div>}
        <div className="grid border-b border-line-soft" style={{ gridTemplateColumns: cols }}>
          <span />
          {data.columns.map((c) => (
            <div key={c.id} className="flex items-baseline justify-between gap-2 border-l border-line-soft px-3 py-2">
              <span className="truncate text-[15px] font-semibold">{c.label}</span>
              <span className="shrink-0 text-[12.5px] text-muted">{c.hours.length ? t("columnSummary", { count: c.count, free: duration(c.freeMinutes) }) : t("closed")}</span>
            </div>
          ))}
        </div>
        <div className="max-h-[calc(100vh-250px)] min-h-[420px] overflow-y-auto">
          <div className="relative grid" style={{ gridTemplateColumns: cols, height: scale.height }}>
            <TimeAxis scale={scale} />
            {data.columns.map((c) => (
              <div key={c.id} className="relative border-l border-line-soft">
                <ColumnBackground scale={scale} surgery={c.surgery} hours={c.hours} flex={c.flex} surgeryLabel={t("bands.surgery")} />
                <GridLines scale={scale} />
                {c.blocks.map((b) => (
                  <div key={b.id} className="absolute left-1 right-1 overflow-hidden rounded-[8px] bg-[repeating-linear-gradient(45deg,var(--color-line-softer)_0_6px,var(--color-line)_6px_8px)] px-2 py-1 text-[12px] text-ink-3" style={place(scale, b.start, b.end)}>
                    {b.label ?? t(`blockKinds.${b.kind}`)} · {hhmm(b.start)}–{hhmm(b.end)}
                  </div>
                ))}
                {c.gaps.map((g) => (
                  <button key={g.start} type="button" onClick={() => setPanel({ kind: "book", resourceId: c.id, start: g.start })}
                    className="absolute left-1 right-1 flex items-start rounded-[8px] border border-dashed border-ok/60 bg-ok-bg/40 px-2 py-0.5 text-left text-[12.5px] font-semibold text-ok-ink hover:bg-ok-bg"
                    style={place(scale, g.start, g.end)}>
                    + {t("free", { minutes: duration(g.end - g.start) })}
                  </button>
                ))}
                {c.flexGaps.map((g) => (
                  <button key={`f${g.start}`} type="button" onClick={() => setPanel({ kind: "book", resourceId: c.id, start: g.start, flex: true })}
                    title={t("flexNote")}
                    className="absolute left-1 right-1 flex items-start rounded-[8px] border border-dashed border-line-strong px-2 py-0.5 text-left text-[11.5px] font-semibold text-muted opacity-70 hover:bg-surface/80 hover:opacity-100"
                    style={place(scale, g.start, g.end)}>
                    + {t("flexSlot")}
                  </button>
                ))}
                {data.appointments.filter((a) => a.resourceId === c.id).map((a) => {
                  const box = place(scale, a.start, a.end);
                  const tight = box.height < 30;
                  return (
                    <button key={a.id} type="button" onClick={() => setPanel({ kind: "appointment", id: a.id })}
                      // Cancelled / no-show: a small chip on the right, so the freed time stays clickable.
                      className={`absolute ${a.active ? "left-1" : "left-auto w-[40%] min-w-[120px]"} right-1 flex justify-between gap-2 overflow-hidden rounded-[7px] px-2 text-left shadow-[0_1px_2px_rgba(0,0,0,0.06)] ${tight ? "items-center text-[12px] leading-none" : "items-start py-1 text-[13px]"} ${calColor(a.type.color).box} ${!a.active ? "line-through opacity-50" : a.status === "DONE" ? "opacity-60" : ""} ${panel.kind === "appointment" && panel.id === a.id ? "ring-2 ring-primary" : ""}`}
                      style={{ ...box, zIndex: a.active ? 2 : 3 }}>
                      <span className="min-w-0 truncate">
                        <b>{a.time}</b> <b>{a.patient?.short ?? t("noPatient")}</b>{a.patient && a.patient.flag !== "NONE" && <span className="ml-1 inline-block align-middle"><FlagDot flag={a.patient.flag as "YELLOW" | "RED"} label={t("flagged")} /></span>} <span className="opacity-80">· {a.type.label}{a.reason && ` · ${a.reason}`}</span>
                      </span>
                      <span className="shrink-0">{statusChip(a)}</span>
                    </button>
                  );
                })}
              </div>
            ))}
            <Folds scale={scale} left={56} label={t("folded")} />
            <NowLine dates={[data.date]} scale={scale} left={56} focus={office?.from} />
          </div>
        </div>
      </section>

      {open && (
        <aside className={`${card} sticky top-[88px] flex max-h-[calc(100vh-110px)] w-[380px] shrink-0 flex-col gap-4 overflow-y-auto p-5 max-lg:fixed max-lg:inset-x-3 max-lg:bottom-3 max-lg:top-auto max-lg:z-40 max-lg:w-auto max-lg:shadow-[0_12px_40px_rgba(28,32,36,0.25)]`}>
          {panel.kind === "book" && <BookingPanel key={`${panel.resourceId}${panel.start}`} data={data} types={types} initial={panel} close={() => setPanel({ kind: "default" })} />}
          {panel.kind === "appointment" && selected && <AppointmentPanel key={selected.id} a={selected} data={data} close={() => setPanel({ kind: "default" })} />}
        </aside>
      )}
    </div>
  );
}
