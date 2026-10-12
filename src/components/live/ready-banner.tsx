"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useLive, type LiveAppointment } from "./use-live";

const minutesAgo = (iso: string) => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60e3));

// A short two-tone chime (no sound file; browsers play it once the page has been used).
function chime() {
  try {
    const ctx = new AudioContext();
    [880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.18);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + i * 0.18 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.18 + 0.35);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.18);
      o.stop(ctx.currentTime + i * 0.18 + 0.4);
    });
  } catch {}
}

// "Ready in room" banner for the surgeon (DESIGN 1a/1c): shows on every page when the
// PA/nurse or the front desk marks one of their patients ready; sound; open the record.
export function ReadyBanner({ companyId, resourceIds }: { companyId: string; resourceIds: string[] }) {
  const t = useTranslations("live");
  const [items, setItems] = useState<LiveAppointment[]>([]);
  const [, setTick] = useState(0);
  useLive((e) => {
    if (e.companyId !== companyId || !resourceIds.includes(e.resourceId)) return;
    if (e.status === "READY" && e.action === "status") {
      setItems((x) => [e, ...x.filter((y) => y.appointmentId !== e.appointmentId)].slice(0, 3));
      chime();
    } else {
      // Moved on (with the doctor, cancelled…): the banner goes.
      setItems((x) => x.filter((y) => y.appointmentId !== e.appointmentId));
    }
  });
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);
  if (!items.length) return null;
  return (
    <div role="status" aria-live="assertive" className="sticky top-0 z-50 flex flex-col gap-1.5 px-4 pt-3 md:px-6">
      {items.map((e) => {
        const ago = minutesAgo(e.at);
        return (
          <div key={e.appointmentId} className="flex flex-wrap items-center gap-3 rounded-[14px] bg-ok px-4 py-3 text-white shadow-[0_8px_24px_rgba(28,32,36,0.18)]">
            <span className="text-[20px]" aria-hidden="true">●</span>
            <span className="min-w-0 flex-1 text-[15px]">
              <b>{t("ready", { name: e.patientShort ?? t("patient") })}</b>
              {e.room && ` · ${e.room}`}
              {e.byName && ` · ${e.byName}`}
              {` · ${ago ? t("minutesAgo", { minutes: ago }) : t("justNow")}`}
            </span>
            {e.patientId && <Link href={`/patients/${e.patientId}`} className="rounded-control bg-white px-3 py-2 text-sm font-semibold text-ok-ink">{t("open")}</Link>}
            <button type="button" aria-label={t("dismiss")} onClick={() => setItems((x) => x.filter((y) => y.appointmentId !== e.appointmentId))} className="px-2 text-lg">✕</button>
          </div>
        );
      })}
    </div>
  );
}
