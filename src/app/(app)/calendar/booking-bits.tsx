"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { inputClass, Notice, secondaryButton } from "@/components/ui";
import type { BookingResult } from "./actions";

// Booking anyway (SPEC §4c hours): a flex zone takes one more click; off-hours and
// weekends need a written reason (kept in the log); a clash just a second click.
export function Anyway({ r, pending, go, label }: { r: BookingResult; pending: boolean; go: (o: { flex?: boolean; override?: boolean; overrideReason?: string }) => void; label: string }) {
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
export function Outcome({ r, pick }: { r: BookingResult; pick: (date: string, time: string) => void }) {
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

