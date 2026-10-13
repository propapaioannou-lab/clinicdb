"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { primaryButton, secondaryButton } from "@/components/ui";
import { quickBookAction } from "./actions";
import type { BookPick } from "./drag-surface";

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

// The confirm strip of «+ Ραντεβού» from the patient record (6a-9): after a click on a
// free time, "Ελένη Μ. · Νέα συμβουλευτική 25′ → Τρι 13/10 · 18:35–19:00" with
// «Κλείσιμο» / «Άλλη ώρα». Booked → the day opens with the new appointment.
export function BookConfirm({ patientId, typeId, who, columns }: { patientId: string; typeId: string; who: string; columns: Record<string, string> }) {
  const t = useTranslations("calendar.fromRecord");
  const router = useRouter();
  const [pick, setPick] = useState<BookPick | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const on = (e: Event) => {
      setError(null);
      setPick((e as CustomEvent<BookPick>).detail);
    };
    window.addEventListener("clinic:book-pick", on);
    return () => window.removeEventListener("clinic:book-pick", on);
  }, []);
  if (!pick) return null;

  const book = () =>
    start(async () => {
      const r = await quickBookAction({ patientId, typeId, resourceId: pick.resourceId, date: pick.date, time: pick.time, minutes: pick.minutes, flex: pick.flex });
      if (!r.ok) return setError(r.problems?.[0] ?? t("refused"));
      router.replace(`/calendar?date=${pick.date}&booked=${encodeURIComponent(patientId)}`);
    });
  return (
    <div role="dialog" aria-label={t("confirm")} className="fixed bottom-6 left-1/2 z-[70] flex w-[min(640px,calc(100vw-24px))] -translate-x-1/2 flex-wrap items-center gap-3 rounded-[14px] border-2 border-primary bg-surface px-4 py-3 shadow-[0_16px_40px_rgba(28,32,36,0.28)]">
      <span className="flex min-w-0 flex-1 flex-col">
        <b className="text-[15px]">{who} → {pick.label}–{hhmm(pick.start + pick.minutes)}</b>
        <span className="text-[12.5px] text-muted">{columns[pick.resourceId]}{pick.flex && ` · ${t("flex")}`}</span>
        {error && <span role="alert" className="text-[13px] text-danger-ink">{error}</span>}
      </span>
      <button type="button" disabled={pending} onClick={book} className={`${primaryButton} min-h-10`}>{t("book")}</button>
      <button type="button" disabled={pending} onClick={() => setPick(null)} className={`${secondaryButton} min-h-10`}>{t("other")}</button>
    </div>
  );
}
