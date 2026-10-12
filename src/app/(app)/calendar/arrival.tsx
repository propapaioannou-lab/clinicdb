"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { inputClass, primaryButton, secondaryButton } from "@/components/ui";
import { splitName } from "@/lib/calendar/names";
import { arriveAction, duplicatesAction, statusAction } from "./actions";
import { TagChips } from "./quick-book";

export type ArrivalPatient = { id: string; firstName: string; surname: string; phone: string | null; email: string | null; tags: string[] };

// «Άφιξη ✓». For patients booked quickly (tags «προς επιβεβαίωση» / «χωρίς τηλέφωνο»)
// the first step is «Επιβεβαίωση στοιχείων» (DESIGN 6g panel 5): name as on the ID,
// mobile/email, a last duplicate check. It can be skipped; the tags then stay.
export function ArrivalButton({ id, when, patient, label, className }: { id: string; when: string; patient: ArrivalPatient | null; label: string; className: string }) {
  const t = useTranslations("calendar");
  const a = useTranslations("calendar.arrival");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tagged = !!patient && patient.tags.length > 0;
  const [v, setV] = useState({ name: patient ? `${patient.firstName} ${patient.surname}`.trim() : "", mobile: patient?.phone ?? "", email: patient?.email ?? "" });
  const [dups, setDups] = useState<{ id: string; name: string }[] | null>(null);

  // Last duplicate check, as the details are typed (this patient left out).
  useEffect(() => {
    if (!open || !patient) return;
    let live = true;
    const id = setTimeout(() => duplicatesAction({ name: v.name, mobile: v.mobile }, patient.id).then((x) => live && setDups(x)), 250);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [open, patient, v.name, v.mobile]);

  const done = (r: { ok?: boolean; error?: string; patientError?: string }) => {
    if (r.ok) {
      setOpen(false);
      router.refresh();
    } else setError(r.patientError ? a(`errors.${r.patientError}`) : t(`errors.${r.error}`));
  };
  const plain = () => start(async () => done(await statusAction(id, "ARRIVED")));
  const confirm = () =>
    start(async () => {
      const { firstName, surname } = splitName(v.name);
      done(await arriveAction(id, { confirm: { firstName, surname, mobile: v.mobile, email: v.email } }));
    });
  const skip = () => start(async () => done(await arriveAction(id, { skip: true })));

  const before = patient ? `${patient.firstName} ${patient.surname}`.trim() : "";
  return (
    <>
      <button type="button" disabled={pending} onClick={() => (tagged ? setOpen(true) : plain())} className={className}>{label}</button>
      {error && !open && <span role="alert" className="text-[12px] text-danger-ink">{error}</span>}
      {/* Opened at page level, above the calendar (not inside the side panel). */}
      {open && patient && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div role="dialog" aria-label={a("title")} className="flex w-[440px] max-w-full flex-col gap-3 rounded-card bg-surface p-5 shadow-[0_16px_48px_rgba(28,32,36,0.3)]">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-[17px] font-semibold">{a("title")}</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label={t("close")} className="text-muted hover:text-ink">✕</button>
            </div>
            <span className="flex flex-wrap items-center gap-1.5 text-[14px]"><b>{when}</b><TagChips tags={patient.tags} /></span>
            <label className="text-[13px] text-ink-3">{a("nameAsId")} <span className="text-danger">*</span>
              <span className="flex items-center gap-2">
                <input autoFocus value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} className={inputClass} />
              </span>
              {v.name.trim() !== before && <span className="text-[12px] text-muted line-through">{before}</span>}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[13px] text-ink-3">{a("mobile")}<input value={v.mobile} onChange={(e) => setV({ ...v, mobile: e.target.value })} inputMode="tel" className={inputClass} /></label>
              <label className="text-[13px] text-ink-3">{a("email")}<input value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} inputMode="email" placeholder={a("optional")} className={inputClass} /></label>
            </div>
            {dups && (dups.length ? (
              <div className="rounded-[10px] border border-warn-line bg-warn-bg/70 px-3 py-2 text-[13px] text-warn-ink">
                <b>{a("maybeExists")}</b> {dups.map((d) => d.name).join(" · ")}
                <div className="text-[12px]">{a("mergeLater")}</div>
              </div>
            ) : (
              <span className="text-[13px] font-semibold text-ok-ink">✓ {v.mobile.trim() ? a("noDupPhone") : a("noDupName")}</span>
            ))}
            {error && <p role="alert" className="text-[13px] text-danger-ink">{error}</p>}
            <button type="button" disabled={pending || v.name.trim().length < 2} onClick={confirm} className={primaryButton}>{a("confirm")}</button>
            <button type="button" disabled={pending} onClick={skip} className={secondaryButton}>{a("skip")}</button>
            <p className="text-[12px] text-muted">{a("logged")}</p>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
