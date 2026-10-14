"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { SearchIcon } from "@/components/icons";
import { FlagDot } from "@/components/patient-bits";
import { inputClass, primaryButton, secondaryButton } from "@/components/ui";
import type { BookingPatient } from "@/lib/calendar/quick";
import { bubbleAddAction, bookingSearchAction, duplicatesAction } from "./actions";

type Dup = BookingPatient & { birthYear: number | null; by: "phone" | "name" };
export type SearchType = { id: string; label: string; minutes: number };
const dmy = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

// The calendar's search (calendar v3): a window over the calendar, so the calendar never
// goes away. A patient found → «Περιμένει ώρα» puts them in a bubble at the top of the
// right-hand column (or «Καρτέλα» opens the record); a new patient → name (+ mobile),
// with «Μήπως υπάρχει ήδη;». Opened by the search box of the column or Ctrl K.
export function CalendarSearch({ types, newType }: { types: SearchType[]; newType: SearchType | null }) {
  const t = useTranslations("calendar.search");
  const router = useRouter();
  const trigger = useRef<HTMLButtonElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<BookingPatient[] | null>(null);
  const [typeId, setTypeId] = useState(types[0]?.id ?? "");
  const [fresh, setFresh] = useState<{ name: string; mobile: string } | null>(null);
  const [dups, setDups] = useState<Dup[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const inBrowser = useSyncExternalStore(() => () => {}, () => true, () => false);

  const close = () => {
    setOpen(false);
    setQ("");
    setFound(null);
    setFresh(null);
    setDups([]);
    setError(null);
  };

  // Ctrl K (or "/") opens it while the column's search box is on screen.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && e.target.closest("input, textarea, select, [contenteditable]");
      if (!((e.key === "/" && !typing) || (e.key === "k" && (e.ctrlKey || e.metaKey)))) return;
      if (!trigger.current?.offsetParent) return;
      e.preventDefault();
      setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (!open) return;
    field.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, fresh]);

  useEffect(() => {
    if (fresh || q.trim().length < 2) return;
    let live = true;
    const id = setTimeout(() => bookingSearchAction(q).then((x) => live && setFound(x)), 180);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [q, fresh]);

  // «Μήπως υπάρχει ήδη;» while a new patient is typed in.
  useEffect(() => {
    if (!fresh) return;
    let live = true;
    const id = setTimeout(() => duplicatesAction({ name: fresh.name, mobile: fresh.mobile }).then((x) => live && setDups(x as Dup[])), 250);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [fresh]);

  const add = (raw: Parameters<typeof bubbleAddAction>[0]) =>
    start(async () => {
      const r = await bubbleAddAction(raw);
      if (r.error) return setError(t("error"));
      close();
      router.refresh();
    });

  const chip = (on: boolean) => `rounded-full border px-3 py-1.5 text-[13px] ${on ? "border-primary bg-primary-tint font-semibold text-primary" : "border-line-strong text-ink-3 hover:border-primary"}`;
  const shown = q.trim().length >= 2 ? found : null;
  const letters = /\p{L}{2,}/u.test(q);

  return (
    <>
      <button ref={trigger} type="button" onClick={() => setOpen(true)}
        className="flex h-11 w-full items-center gap-2.5 rounded-[11px] border border-line-strong bg-surface px-3.5 text-left text-[14px] text-placeholder hover:border-primary">
        <SearchIcon className="shrink-0 text-muted" />
        <span className="min-w-0 flex-1 truncate">{t("open")}</span>
        <kbd className="rounded-md border border-line-strong px-1.5 py-0.5 font-sans text-xs text-muted">Ctrl K</kbd>
      </button>
      {open && inBrowser && createPortal(
        <div className="fixed inset-0 z-[80] flex items-start justify-center bg-ink/25 px-3 pt-[8vh]" onMouseDown={(e) => e.target === e.currentTarget && close()}>
          <div role="dialog" aria-modal="true" aria-label={t("title")} className="flex max-h-[84vh] w-[min(640px,100%)] flex-col gap-3 overflow-y-auto rounded-card border border-line bg-surface p-4 shadow-[0_24px_64px_rgba(28,32,36,0.3)]">
            {!fresh ? (
              <>
                <label className="flex h-12 items-center gap-2.5 rounded-[11px] border border-line-strong px-3.5 focus-within:border-primary">
                  <SearchIcon className="shrink-0 text-muted" />
                  <input ref={field} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("placeholder")} aria-label={t("title")} autoComplete="off" spellCheck={false}
                    className="min-w-0 flex-1 border-0 bg-transparent text-[16px] outline-none" />
                </label>
                {types.length > 0 && (
                  <div role="group" aria-label={t("forType")} className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[12.5px] text-muted">{t("forType")}</span>
                    {types.map((ty) => <button key={ty.id} type="button" aria-pressed={ty.id === typeId} onClick={() => setTypeId(ty.id)} className={chip(ty.id === typeId)}>{ty.label} {ty.minutes}′</button>)}
                  </div>
                )}
                {shown && shown.length === 0 && <p className="text-sm text-muted">{t("none")}</p>}
                {shown && shown.length > 0 && (
                  <ul className="flex flex-col divide-y divide-line-softer">
                    {shown.map((p) => (
                      <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5">
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="flex items-center gap-2 font-semibold">{p.name}{p.flag !== "NONE" && <FlagDot flag={p.flag} label={p.flagReasons.join(", ") || t("flagged")} />}</span>
                          <span className="text-[12.5px] text-muted">{[p.phone, p.lastVisit && t("last", { when: p.lastVisit }), p.upcoming && t("upcoming", { date: dmy(p.upcoming) })].filter(Boolean).join(" · ")}</span>
                        </span>
                        <button type="button" disabled={pending} onClick={() => add({ patientId: p.id, typeId })} className={`${primaryButton} min-h-10 px-3.5 text-[13.5px]`}>{t("wait")}</button>
                        <Link href={`/patients/${p.id}`} onClick={close} className={`${secondaryButton} min-h-10 px-3.5 text-[13.5px]`}>{t("record")}</Link>
                      </li>
                    ))}
                  </ul>
                )}
                {letters && (
                  <button type="button" onClick={() => setFresh({ name: q.trim(), mobile: /\d{6,}/.test(q) ? q.replace(/[^\d+]/g, "") : "" })}
                    className="self-start rounded-[10px] border border-dashed border-primary px-3.5 py-2 text-[14px] font-semibold text-primary hover:bg-primary-tint">
                    + {t("newPatient", { name: q.trim() })}
                  </button>
                )}
                {!shown && <p className="text-[12.5px] text-muted">{t("hint")}</p>}
              </>
            ) : (
              <div className="flex flex-col gap-3">
                <b className="text-[16px]">{t("newTitle")}</b>
                <label className="flex flex-col gap-1 text-[13px] text-muted">{t("name")}
                  <input ref={field} value={fresh.name} onChange={(e) => setFresh({ ...fresh, name: e.target.value })} className={inputClass} autoComplete="off" />
                </label>
                <label className="flex flex-col gap-1 text-[13px] text-muted">{t("mobile")}
                  <input value={fresh.mobile} onChange={(e) => setFresh({ ...fresh, mobile: e.target.value })} inputMode="tel" className={inputClass} autoComplete="off" />
                </label>
                {newType && <span className="text-[13px] text-ink-3">{t("newType", { type: `${newType.label} ${newType.minutes}′` })}</span>}
                {dups.length > 0 && (
                  <div className="flex flex-col gap-2 rounded-[12px] border border-warn-line bg-warn-bg/60 px-3.5 py-2.5">
                    <b className="text-[13.5px] text-warn-ink">{t("maybe")}</b>
                    {dups.map((d) => (
                      <span key={d.id} className="flex flex-wrap items-center gap-2 text-[13.5px]">
                        <span className="min-w-0 flex-1"><b>{d.name}</b> <span className="text-muted">{[d.birthYear, d.phone, d.lastVisit && t("last", { when: d.lastVisit })].filter(Boolean).join(" · ")}</span></span>
                        <button type="button" disabled={pending} onClick={() => add({ patientId: d.id, typeId })} className={`${secondaryButton} min-h-9 px-3 text-[13px]`}>{t("thisOne")}</button>
                      </span>
                    ))}
                  </div>
                )}
                {error && <p role="alert" className="text-[13px] text-danger-ink">{error}</p>}
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={pending || fresh.name.trim().length < 2} onClick={() => add({ newPatient: { name: fresh.name, mobile: fresh.mobile } })} className={`${primaryButton} min-h-10`}>{t("addNew")}</button>
                  <button type="button" disabled={pending} onClick={() => { setFresh(null); setDups([]); }} className={`${secondaryButton} min-h-10`}>{t("back")}</button>
                </div>
              </div>
            )}
            {error && !fresh && <p role="alert" className="text-[13px] text-danger-ink">{error}</p>}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
