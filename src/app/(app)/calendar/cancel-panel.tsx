"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { inputClass, secondaryButton } from "@/components/ui";
import type { CancelKind } from "@/lib/calendar/cancel";
import type { WaitlistMatch } from "@/lib/calendar/waitlist";
import { bookFromWaitlistAction, cancelAction, cancelPreviewAction } from "./actions";

type Preview = NonNullable<Awaited<ReturnType<typeof cancelPreviewAction>>>;
const KINDS: CancelKind[] = ["cancel", "late", "no_show", "error"];

// «Ακύρωση — δεν διαγράφεται» (DESIGN 6g panel 4): four ways, with the flag each one
// gives; the freed time is then offered to the waiting list.
export function CancelPanel({ id, title, when, date, close }: { id: string; title: string; when: string; date: string; close: () => void }) {
  const t = useTranslations("calendar.cancel");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [p, setP] = useState<Preview | null>(null);
  const [kind, setKind] = useState<CancelKind | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ flag: string | null; matches: WaitlistMatch[]; resourceId: string } | null>(null);
  const [booked, setBooked] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    cancelPreviewAction(id).then((x) => live && x && setP(x));
    return () => {
      live = false;
    };
  }, [id]);
  const chosen = kind ?? p?.suggested ?? null;

  const flagOf = (k: CancelKind) => (k === "late" ? p?.lateFlag : k === "no_show" ? "RED" : null);
  const submit = () =>
    chosen &&
    start(async () => {
      const r = await cancelAction(id, { kind: chosen, reason });
      if (r.error) return setError(t(`errors.${r.error}`));
      setDone({ flag: r.flag ?? null, matches: r.matches ?? [], resourceId: r.resourceId ?? "" });
      router.refresh();
    });

  if (done)
    return (
      <div className="flex flex-col gap-3">
        <h2 className="text-[17px] font-semibold">{t(`done.${chosen}`)}</h2>
        {done.flag && <p className={`text-sm font-semibold ${done.flag === "RED" ? "text-danger-ink" : "text-warn-ink"}`}>⚑ {t(done.flag === "RED" ? "flagRed" : "flagYellow")}</p>}
        {done.matches.length > 0 ? (
          <div className="flex flex-col gap-2 rounded-[10px] border border-ok/50 bg-ok-bg/50 px-3 py-2.5 text-sm">
            <b>{t("offer", { count: done.matches.length })}</b>
            {done.matches.map((m) => (
              <span key={m.id} className="flex flex-wrap items-center justify-between gap-2">
                <span><b>{m.name}</b> <span className="text-ink-3">· {m.type ?? t("anyType")} · {m.time}{m.phone && ` · ${m.phone}`}</span></span>
                {booked === m.id ? <span className="font-semibold text-ok-ink">✓ {t("booked")}</span> : (
                  <button type="button" disabled={pending || !!booked} className="min-h-9 rounded-control bg-primary px-3 text-[13px] font-semibold text-white"
                    onClick={() => start(async () => {
                      const r = await bookFromWaitlistAction(m.id, { resourceId: done.resourceId, date, time: m.time });
                      if (r.ok) {
                        setBooked(m.id);
                        router.refresh();
                      } else setError(r.problems?.[0] ?? t("errors.invalid_value"));
                    })}>{t("bookThem")}</button>
                )}
              </span>
            ))}
            <span className="text-[12px] text-muted">{t("whatsappLater")}</span>
          </div>
        ) : chosen !== "no_show" && <p className="text-sm text-muted">{t("noMatches")}</p>}
        {error && <p role="alert" className="text-sm text-danger-ink">{error}</p>}
        <button type="button" onClick={close} className={`${secondaryButton} self-start`}>{t("close")}</button>
      </div>
    );

  const hours = p ? Math.round(p.hoursUntil) : null;
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-[17px] font-semibold">{t("title")}</h2>
      <p className="text-[13px] text-ink-3">{t("intro")}</p>
      <p className="text-sm"><b>{title}</b> · {when}{hours !== null && <span className={hours < (p?.lateHours ?? 48) ? "font-semibold text-warn-ink" : "text-muted"}> · {hours >= 0 ? t("inHours", { hours }) : t("ago", { hours: -hours })}</span>}</p>
      <div role="radiogroup" aria-label={t("title")} className="flex flex-col gap-2">
        {KINDS.map((k) => {
          const off = k === "no_show" && !p?.noShowAllowed;
          const f = flagOf(k);
          return (
            <label key={k} className={`flex cursor-pointer items-start gap-3 rounded-[10px] border px-3 py-2.5 ${chosen === k ? "border-2 border-ink" : "border-line"} ${off ? "cursor-not-allowed opacity-45" : ""}`}>
              <input type="radio" name="cancel" checked={chosen === k} disabled={off} onChange={() => setKind(k)} className="mt-1 h-4 w-4 accent-primary" />
              <span className="flex flex-1 flex-col">
                <span className="text-[14.5px] font-semibold">{t(`kinds.${k}`)}</span>
                <span className="text-[12.5px] text-muted">{t(`hints.${k}`, { hours: p?.lateHours ?? 48 })}</span>
              </span>
              {f && <span className={`flex items-center gap-1 text-[12px] font-semibold ${f === "RED" ? "text-danger-ink" : "text-warn-ink"}`}><span className={`h-2.5 w-2.5 rounded-full ${f === "RED" ? "bg-danger" : "bg-warn"}`} />{t(f === "RED" ? "red" : "yellow")}</span>}
            </label>
          );
        })}
      </div>
      <label className="text-[13px] text-ink-3">{t("reason")}{chosen === "error" && <span className="text-danger"> *</span>}
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("reasonHint")} className={inputClass} />
      </label>
      {p && (
        <p className="text-[12.5px] text-ink-3">
          {p.priorLate > 0 ? t("secondLate", { months: p.lateMonths }) : t("lateRule", { months: p.lateMonths })}
          {p.matches.length > 0 && <> {t("matchesNote", { count: p.matches.length })}</>}
        </p>
      )}
      {error && <p role="alert" className="text-sm text-danger-ink">{error}</p>}
      <div className="flex gap-2">
        <button type="button" disabled={pending || !chosen || (chosen === "error" && !reason.trim())} onClick={submit}
          className="min-h-10 rounded-control border-2 border-danger px-4 text-sm font-semibold text-danger hover:bg-danger-bg disabled:opacity-50">{t("submit")}</button>
        <button type="button" onClick={close} className={secondaryButton}>{t("back")}</button>
      </div>
    </div>
  );
}
