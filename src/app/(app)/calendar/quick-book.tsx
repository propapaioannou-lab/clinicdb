"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { inputClass, primaryButton, secondaryButton } from "@/components/ui";
import { calColor } from "@/lib/calendar/colors";
import type { DayData } from "@/lib/calendar/day";
import type { BookingPatient } from "@/lib/calendar/quick";
import { bookingSearchAction, duplicatesAction, quickBookAction, slotCheckAction, type BookingResult } from "./actions";
import { Anyway, Outcome } from "./booking-bits";

export type QuickType = { id: string; label: string; minutes: number; color: string; forNewPatients: boolean };
type Dup = BookingPatient & { birthYear: number | null; by: "phone" | "name" };

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const minutesOf = (t: string) => (/^\d{1,2}:\d{2}$/.test(t) ? Number(t.split(":")[0]) * 60 + Number(t.split(":")[1]) : null);
const dmy = (iso: string) => iso.split("-").reverse().join("/");
const day = new Intl.DateTimeFormat("el-GR", { weekday: "short", day: "numeric", month: "numeric", timeZone: "UTC" });
const isDigits = (q: string) => /^[\d\s+\-().]+$/.test(q.trim());

function useDebounced<T>(value: T, ms = 220) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

// Quick booking (DESIGN 6g panels 1–2): a small panel next to the slot. One search field
// (name or phone); an existing patient → one tap on a type; a new patient → name only,
// type fixed to the new-patient type, «Μήπως υπάρχει ήδη;» as you type.
export function QuickBook({ data, types, at, close }: { data: DayData; types: QuickType[]; at: { resourceId: string; start: number; flex?: boolean; x?: number; y?: number }; close: () => void }) {
  const t = useTranslations("calendar");
  const q8 = useTranslations("calendar.quick");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BookingPatient[]>([]);
  const [patient, setPatient] = useState<BookingPatient | null>(null);
  const [fresh, setFresh] = useState<{ name: string; mobile: string; email: string } | null>(null);
  const [dups, setDups] = useState<Dup[]>([]);
  const existingTypes = types.filter((x) => !x.forNewPatients);
  const newType = types.find((x) => x.forNewPatients);
  const [typeId, setTypeId] = useState(existingTypes[0]?.id ?? types[0]?.id ?? "");
  const type = fresh && newType ? newType : types.find((x) => x.id === typeId);
  const [time, setTime] = useState(hhmm(at.start));
  // The length follows the chosen type unless changed by hand.
  const [ownMinutes, setMinutes] = useState<string | null>(null);
  const minutes = ownMinutes ?? String(type?.minutes ?? 30);
  const [editTime, setEditTime] = useState(false);
  const [check, setCheck] = useState<BookingResult | null>(null);
  const [r, setR] = useState<BookingResult>({});
  const column = data.columns.find((c) => c.id === at.resourceId);
  // Drawn only in the browser (it attaches to the page body).
  const inBrowser = useSyncExternalStore(() => () => {}, () => true, () => false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  // Search as you type.
  const dq = useDebounced(query);
  useEffect(() => {
    if (patient || fresh || dq.trim().length < 2) return;
    let live = true;
    bookingSearchAction(dq).then((x) => live && setResults(x));
    return () => {
      live = false;
    };
  }, [dq, patient, fresh]);

  // «Μήπως υπάρχει ήδη;» for a new patient (by mobile, else by name).
  const dFresh = useDebounced(fresh);
  useEffect(() => {
    if (!dFresh) return;
    let live = true;
    duplicatesAction(dFresh).then((x) => live && setDups(x as Dup[]));
    return () => {
      live = false;
    };
  }, [dFresh]);

  // "18:35 – 19:00 · ελεύθερο ✓" — checked as the time, length or patient changes.
  const booking = { typeId: type?.id ?? "", resourceId: at.resourceId, date: data.date, time, minutes, flex: at.flex };
  const dCheck = useDebounced(JSON.stringify({ ...booking, patientId: patient?.id ?? null }), 250);
  useEffect(() => {
    let live = true;
    slotCheckAction(JSON.parse(dCheck)).then((x) => live && setCheck(x));
    return () => {
      live = false;
    };
  }, [dCheck]);

  const submit = (o: { flex?: boolean; override?: boolean; overrideReason?: string } = {}) =>
    start(async () => {
      const res = await quickBookAction({
        ...booking,
        ...(patient ? { patientId: patient.id } : { newPatient: fresh, notDuplicateOf: dups.map((d) => d.id) }),
        ...o,
      });
      setR(res);
      if (res.ok) {
        router.refresh();
        if (!res.warned?.length) close();
      }
    });

  const startMin = minutesOf(time) ?? at.start;
  const len = Number(minutes) || 0;
  const reach = fresh ? (fresh.mobile.trim() ? "phone" : fresh.email.trim() ? "email" : "none") : null;
  const ready = !!type && (patient || (fresh && fresh.name.trim().length >= 2));
  // Placed next to the slot that was clicked, kept inside the window.
  const style: React.CSSProperties =
    at.x !== undefined && at.y !== undefined && typeof window !== "undefined"
      ? (() => {
          const top = Math.max(76, Math.min(at.y - 40, window.innerHeight - 640));
          return { left: Math.max(12, Math.min(at.x + 14, window.innerWidth - 404)), top, maxHeight: window.innerHeight - top - 12 };
        })()
      : { right: 24, top: 150 };

  if (!inBrowser) return null;
  return createPortal(
    <div role="dialog" aria-label={t("newAppointment")} style={style}
      className="fixed z-50 flex max-h-[calc(100vh-96px)] w-[380px] max-w-[calc(100vw-24px)] flex-col gap-3 overflow-y-auto rounded-card border border-line bg-surface p-4 shadow-[0_16px_48px_rgba(28,32,36,0.22)]">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[16px] font-semibold">{t("newAppointment")} <span className="text-[13px] font-normal text-muted first-letter:uppercase">{day.format(new Date(`${data.date}T12:00:00Z`))} · {time}</span></h2>
        <button type="button" onClick={close} aria-label={t("close")} className="text-muted hover:text-ink">✕</button>
      </div>

      {/* 1 · who */}
      {patient ? (
        <div className="flex flex-col gap-1 rounded-[10px] border border-primary bg-primary-tint px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <b className="text-[14.5px]">{patient.name}{patient.flag !== "NONE" && <span className={`ml-1.5 inline-block h-2.5 w-2.5 rounded-full ${patient.flag === "RED" ? "bg-danger" : "bg-warn"}`} />}</b>
            <button type="button" onClick={() => { setPatient(null); setQuery(""); }} className="text-[12.5px] font-semibold text-primary">{q8("change")}</button>
          </div>
          <span className="text-[12.5px] text-ink-3">{[patient.phone, patient.lastVisit ? q8("lastVisit", { when: patient.lastVisit }) : q8("noVisit"), patient.upcoming ? q8("upcoming", { when: dmy(patient.upcoming.slice(0, 10)) }) : q8("noUpcoming")].filter(Boolean).join(" · ")}</span>
          {patient.flag !== "NONE" && <span className={`text-[12.5px] font-semibold ${patient.flag === "RED" ? "text-danger-ink" : "text-warn-ink"}`}>⚑ {q8(patient.flag === "RED" ? "flagRed" : "flagYellow")}{patient.flagReasons.length > 0 && `: ${patient.flagReasons.join(", ")}`}</span>}
          {patient.tags.length > 0 && <TagChips tags={patient.tags} />}
        </div>
      ) : fresh ? (
        <div className="flex flex-col gap-2">
          <label className="text-[13px] text-ink-3">{q8("fullName")} <span className="text-danger">*</span>
            <input autoFocus value={fresh.name} onChange={(e) => setFresh({ ...fresh, name: e.target.value })} className={inputClass} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[13px] text-ink-3">{q8("mobile")}<input value={fresh.mobile} onChange={(e) => setFresh({ ...fresh, mobile: e.target.value })} inputMode="tel" placeholder={q8("optional")} className={inputClass} /></label>
            <label className="text-[13px] text-ink-3">{q8("email")}<input value={fresh.email} onChange={(e) => setFresh({ ...fresh, email: e.target.value })} inputMode="email" placeholder={q8("optional")} className={inputClass} /></label>
          </div>
          {dups.length > 0 && (
            <div className="flex flex-col gap-1 rounded-[10px] border border-warn-line bg-warn-bg/70 px-3 py-2 text-[13px] text-warn-ink">
              <b>{q8("maybeExists")}</b>
              {dups.map((d) => (
                <span key={d.id} className="flex flex-wrap items-baseline justify-between gap-x-2">
                  <span>{d.name}{d.birthYear && ` · ${d.birthYear}`}{d.lastVisit && ` · ${q8("lastVisit", { when: d.lastVisit })}`}</span>
                  <button type="button" onClick={() => { setPatient(d); setFresh(null); setDups([]); }} className="font-semibold text-primary">{q8("thisIsHer")}</button>
                </span>
              ))}
            </div>
          )}
          <span className="flex flex-wrap items-center gap-1.5"><TagChips tags={["to_confirm", ...(fresh.mobile.trim() ? [] : ["no_phone"])]} /></span>
          {reach === "none" && <span className="text-[12.5px] text-ink-3">→ {q8("cannotNotify")}</span>}
          {reach === "email" && <span className="text-[12.5px] text-ink-3">→ {q8("byEmail")}</span>}
        </div>
      ) : (
        <div className="relative">
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={q8("search")} aria-label={q8("search")} className={`${inputClass} mt-0`} />
          {query.trim().length >= 2 && (
            <ul className="mt-1.5 flex flex-col overflow-hidden rounded-[10px] border border-line-soft">
              {results.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => setPatient(p)} className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-primary-tint">
                    <span className="text-[14px] font-semibold">{p.name}{p.flag !== "NONE" && <span className={`ml-1.5 inline-block h-2 w-2 rounded-full ${p.flag === "RED" ? "bg-danger" : "bg-warn"}`} />}</span>
                    <span className="text-[12px] text-muted">{[p.phone ?? q8("noPhone"), p.lastVisit ? q8("lastVisit", { when: p.lastVisit }) : q8("noVisit"), p.upcoming ? q8("upcoming", { when: dmy(p.upcoming.slice(0, 10)) }) : null].filter(Boolean).join(" · ")}</span>
                  </button>
                </li>
              ))}
              <li>
                <button type="button" onClick={() => setFresh(isDigits(query) ? { name: "", mobile: query.trim(), email: "" } : { name: query.trim(), mobile: "", email: "" })}
                  className="w-full px-3 py-2 text-left text-[13.5px] font-semibold text-primary hover:bg-primary-tint">
                  + {q8("newPatient", { q: query.trim().slice(0, 18) })}{newType && <span className="font-normal text-ink-3"> → {newType.label} {newType.minutes}′</span>}
                </button>
              </li>
            </ul>
          )}
        </div>
      )}

      {/* 2 · type (sets the length) */}
      {(patient || fresh) && (
        fresh && newType ? (
          <span className="text-[13px] text-ink-3">{t("type")}: <b className="text-ink">{newType.label} · {newType.minutes}′</b> <span className="text-muted">({q8("fixed")})</span></span>
        ) : (
          <div className="flex flex-col gap-1.5">
            <span className="text-[12.5px] text-muted">{q8("typeSetsLength")}</span>
            <div className="flex flex-wrap gap-1.5">
              {existingTypes.map((ty) => (
                <button key={ty.id} type="button" aria-pressed={typeId === ty.id} onClick={() => { setTypeId(ty.id); setMinutes(null); }}
                  className={`min-h-9 rounded-full border px-3 text-[13px] ${typeId === ty.id ? "border-primary bg-primary font-semibold text-white" : "border-line-strong text-ink-2 hover:border-primary"}`}>
                  {typeId !== ty.id && <span className={`mr-1.5 inline-block h-2 w-2 rounded-full align-middle ${calColor(ty.color).dot}`} />}{ty.label} {ty.minutes}′
                </button>
              ))}
            </div>
          </div>
        )
      )}

      {/* 3 · when */}
      {(patient || fresh) && (
        <div className="flex flex-col gap-1.5 text-[13.5px]">
          <span className="flex flex-wrap items-center gap-x-2">
            <b>{hhmm(startMin)} – {hhmm(startMin + len)}</b>
            <span className="text-muted">· {column?.label}</span>
            {check?.ok ? <span className="font-semibold text-ok-ink">· {q8("free")} ✓</span> : check?.flexOnly ? <span className="font-semibold text-warn-ink">· {t("flexZone")}</span> : check?.error ? <span className="font-semibold text-danger-ink">· {check.problems?.[0] ?? t(`errors.${check.error}`)}</span> : null}
            <button type="button" onClick={() => setEditTime((x) => !x)} className="ml-auto text-[12.5px] font-semibold text-primary">{q8("changeTime")}</button>
          </span>
          {editTime && (
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[12.5px] text-ink-3">{t("time")}<input value={time} onChange={(e) => setTime(e.target.value)} placeholder="ΩΩ:ΛΛ" inputMode="numeric" className={inputClass} /></label>
              <label className="text-[12.5px] text-ink-3">{t("minutes")}<input value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={inputClass} /></label>
            </div>
          )}
        </div>
      )}

      {r.patientError && <p role="alert" className="text-[13px] text-danger-ink">{q8(`patientErrors.${r.patientError}`)}</p>}
      <Outcome r={r} pick={(_, tm) => { setTime(tm); setR({}); }} />
      {(patient || fresh) && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={pending || !ready} onClick={() => submit()} className={`${primaryButton} min-h-10`}>{q8("book")}</button>
          <Anyway r={r} pending={pending} go={submit} label={t("bookAnyway")} />
          {fresh && <button type="button" onClick={close} className={`${secondaryButton} min-h-10`}>{q8("cancel")}</button>}
          <span className="text-[12.5px] text-muted" title={t("soonGhl")}>{reach === "none" ? "☐" : "☑"} {q8("whatsapp")} · {t("soonGhl")}</span>
        </div>
      )}
    </div>
  , document.body);
}

export function TagChips({ tags }: { tags: string[] }) {
  const t = useTranslations("calendar.tags");
  return (
    <>
      {tags.map((x) => (
        <span key={x} className={`rounded-[6px] px-1.5 py-0.5 text-[11.5px] font-semibold ${x === "to_confirm" ? "bg-warn-bg text-warn-ink" : "bg-line-softer text-ink-3"}`}>
          {t.has(x as "to_confirm") ? t(x as "to_confirm") : x}
        </span>
      ))}
    </>
  );
}
