"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { primaryButton } from "@/components/ui";
import { calColor } from "@/lib/calendar/colors";

// «+ Ραντεβού ▾» on the patient record (DESIGN 2b, 6a-9): choose the type → the calendar
// opens on the first week with room, with this patient's card "in hand". «+ Χειρουργείο»
// comes with 6b.
export function BookMenu({ patientId, types, upcoming, desk }: { patientId: string; types: { id: string; label: string; minutes: number; color: string }[]; upcoming: string | null; desk: boolean }) {
  const t = useTranslations("calendar.fromRecord");
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", away);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("mousedown", away);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <div ref={box} className="relative flex flex-wrap items-start gap-2">
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((x) => !x)} className={`${primaryButton} min-h-[38px] whitespace-nowrap px-3.5`}>+ {t("button")} ▾</button>
      <span title={t("surgerySoon")} className="flex min-h-[38px] items-center whitespace-nowrap rounded-control bg-cal-blue/50 px-3.5 text-sm font-semibold text-white">+ {t("surgery")}</span>
      {open && (
        <div role="menu" aria-label={t("menu")} className="absolute right-0 top-full z-40 mt-2 flex w-[300px] flex-col rounded-[14px] border border-line bg-surface py-2 shadow-[0_12px_32px_rgba(28,32,36,0.18)]">
          <span className="px-4 pb-1.5 text-[12px] text-muted">{t("menuHint")}</span>
          {types.map((ty) => (
            <Link key={ty.id} role="menuitem" href={`/calendar?${new URLSearchParams({ view: "week", bookFor: patientId, type: ty.id, ...(desk && { as: "desk" }) })}`}
              className="flex items-center justify-between gap-3 px-4 py-2 text-[14px] hover:bg-primary-tint">
              <span className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${calColor(ty.color).dot}`} />{ty.label}</span>
              <b>{ty.minutes}′</b>
            </Link>
          ))}
          {upcoming && <span className="mx-4 mt-1.5 border-t border-line-softer pt-2 text-[12.5px] font-semibold text-warn-ink">{t("already", { what: upcoming })}</span>}
        </div>
      )}
    </div>
  );
}
