"use client";

import { num1 } from "@/lib/format";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { PlusIcon } from "@/components/icons";
import { card, ErrorBox, inputClass, Notice, primaryButton, textareaClass } from "@/components/ui";
import { bmi } from "@/lib/history/data";
import { EXAM_AREAS, PROCEDURE_AREAS, findProcedure } from "@/lib/visits/catalog";
import type { VisitArea, VisitProcedure } from "@/lib/visits/visits";
import type { VisitActionState } from "./actions";

export type VisitFormValues = {
  typeId: string;
  date: string; // dd/mm/yyyy, Athens
  time: string; // HH:MM
  general: string;
  areas: VisitArea[];
  procedures: VisitProcedure[];
  diagnosis: string;
  weightKg: string;
  heightCm: string;
};

const chip = (on: boolean) =>
  `min-h-10 rounded-full px-3.5 py-1.5 text-sm ${on ? "border border-primary bg-primary font-semibold text-white" : "border border-line-strong bg-surface text-ink-2 hover:border-primary"}`;
const softChip = (on: boolean) =>
  `min-h-9 rounded-full px-3 py-1 text-[13px] ${on ? "border border-primary bg-primary-tint font-semibold text-primary" : "border border-line-strong bg-surface text-ink-3 hover:border-primary"}`;

// 3 · New visit / visit (DESIGN.md), without planning sketches and recording (later phases).
export function VisitForm({
  types,
  initial,
  previousWeight,
  action,
  aside,
}: {
  types: { id: string; label: string }[];
  initial: VisitFormValues;
  previousWeight: { kg: number; date: string } | null;
  action: (json: string) => Promise<VisitActionState>;
  aside?: React.ReactNode;
}) {
  const t = useTranslations("visit");
  const [v, setV] = useState<VisitFormValues>(initial);
  const [cat, setCat] = useState(PROCEDURE_AREAS[0].key);
  const [state, setState] = useState<VisitActionState>({});
  const [pending, start] = useTransition();
  const set = (patch: Partial<VisitFormValues>) => setV((x) => ({ ...x, ...patch }));

  const weight = Number(v.weightKg.replace(",", "."));
  const height = Number(v.heightCm.replace(",", "."));
  const b = bmi(weight || undefined, height || undefined);
  const chosen = new Set(v.procedures.map((p) => p.key));
  const surgical = v.procedures.some((p) => !findProcedure(p.key)?.nonSurgical);

  const toggleProcedure = (key: string) =>
    setV((x) => ({
      ...x,
      procedures: x.procedures.some((p) => p.key === key) ? x.procedures.filter((p) => p.key !== key) : [...x.procedures, { key, subs: [] }],
    }));
  const toggleSub = (key: string, sub: string) =>
    setV((x) => ({
      ...x,
      procedures: x.procedures.map((p) => (p.key !== key ? p : { ...p, subs: p.subs.includes(sub) ? p.subs.filter((s) => s !== sub) : [...p.subs, sub] })),
    }));
  const addArea = (area: string) => setV((x) => ({ ...x, areas: [...x.areas, { area, text: "" }] }));
  const removeArea = (area: string) => setV((x) => ({ ...x, areas: x.areas.filter((a) => a.area !== area) }));
  const setAreaText = (area: string, text: string) => setV((x) => ({ ...x, areas: x.areas.map((a) => (a.area === area ? { ...a, text } : a)) }));
  // A reminder chip adds "Πτώση (Regnault): " as a new line, ready to complete.
  const addPrompt = (area: string, prompt: string) =>
    setV((x) => ({
      ...x,
      areas: x.areas.map((a) => (a.area === area ? { ...a, text: `${a.text}${a.text && !a.text.endsWith("\n") ? "\n" : ""}${prompt}: ` } : a)),
    }));

  const payload = () =>
    JSON.stringify({
      typeId: v.typeId || null,
      date: v.date,
      time: v.time,
      general: v.general,
      areas: v.areas,
      procedures: v.procedures,
      diagnosis: v.diagnosis,
      weightKg: v.weightKg,
      heightCm: v.heightCm,
    });
  const save = () =>
    start(async () => {
      const r = await action(payload());
      setState(r ?? {});
    });


  return (
    <div className="flex flex-col gap-4">
      {state.error && <ErrorBox>{t(`errors.${state.error}`)}</ErrorBox>}
      {state.saved && <Notice>{t("saved")}</Notice>}

      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
          <section className={`${card} flex flex-col gap-3 p-5`}>
            <div className="flex flex-wrap gap-3">
              <label className="block min-w-[240px] flex-1 text-sm text-ink-3">{t("type")}
                <select value={v.typeId} onChange={(e) => set({ typeId: e.target.value })} className={inputClass}>
                  <option value="">—</option>
                  {types.map((ty) => <option key={ty.id} value={ty.id}>{ty.label}</option>)}
                </select>
              </label>
              <label className="block text-sm text-ink-3">{t("date")}
                <input value={v.date} onChange={(e) => set({ date: e.target.value })} placeholder={t("datePlaceholder")} inputMode="numeric" className={`${inputClass} w-36`} />
              </label>
              <label className="block text-sm text-ink-3">{t("time")}
                <input value={v.time} onChange={(e) => set({ time: e.target.value })} placeholder="ΩΩ:ΛΛ" inputMode="numeric" className={`${inputClass} w-24`} />
              </label>
            </div>
          </section>

          <section className={`${card} flex flex-col gap-4 p-5`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[17px] font-semibold">{t("evaluation")}</h2>
              <div role="group" aria-label={t("addArea")} className="flex flex-wrap gap-2">
                {EXAM_AREAS.filter((a) => !v.areas.some((x) => x.area === a.key)).map((a) => (
                  <button key={a.key} type="button" onClick={() => addArea(a.key)} className="inline-flex min-h-9 items-center gap-1 rounded-full border border-dashed border-line-strong px-3 text-[13px] text-ink-3 hover:border-primary hover:text-primary">
                    <PlusIcon size={14} />{a.el}
                  </button>
                ))}
              </div>
            </div>
            <label className="block text-sm font-medium text-ink-2">{t("general")}
              <textarea rows={3} value={v.general} onChange={(e) => set({ general: e.target.value })} className={textareaClass} />
            </label>
            {v.areas.map((a) => {
              const def = EXAM_AREAS.find((d) => d.key === a.area)!;
              return (
                <div key={a.area} aria-label={t("areaLabel", { area: def.el })} className="flex flex-col gap-2 rounded-[12px] border border-line-soft bg-surface-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-[15px] font-semibold">{def.el}</h3>
                    <button type="button" onClick={() => removeArea(a.area)} aria-label={t("removeArea", { area: def.el })} className="text-sm text-muted hover:text-danger">✕</button>
                  </div>
                  {def.prompts.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {def.prompts.map((pr) => (
                        <button key={pr.el} type="button" onClick={() => addPrompt(a.area, pr.el)} className={softChip(a.text.includes(`${pr.el}:`))}>
                          {pr.el}
                        </button>
                      ))}
                    </div>
                  )}
                  <textarea rows={4} value={a.text} onChange={(e) => setAreaText(a.area, e.target.value)} aria-label={def.el} className={`${textareaClass} mt-0`} />
                </div>
              );
            })}
          </section>

          <section className={`${card} flex flex-col gap-3 p-5`}>
            <h2 className="text-[17px] font-semibold">{t("procedures")}</h2>
            <div role="tablist" aria-label={t("procedureArea")} className="flex flex-wrap gap-2">
              {PROCEDURE_AREAS.map((a) => {
                const count = a.procedures.filter((p) => chosen.has(p.key)).length;
                return (
                  <button key={a.key} type="button" role="tab" aria-selected={cat === a.key} onClick={() => setCat(a.key)} className={softChip(cat === a.key)}>
                    {a.el}{count ? ` · ${count}` : ""}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-2">
              {PROCEDURE_AREAS.find((a) => a.key === cat)!.procedures.map((p) => (
                <button key={p.key} type="button" aria-pressed={chosen.has(p.key)} onClick={() => toggleProcedure(p.key)} className={chip(chosen.has(p.key))}>
                  {chosen.has(p.key) ? "✓ " : "+ "}{p.el}
                </button>
              ))}
            </div>
            {v.procedures.filter((p) => findProcedure(p.key)?.subs).map((p) => {
              const def = findProcedure(p.key)!;
              return (
                <div key={p.key} className="flex flex-col gap-1.5 border-t border-line-softer pt-3">
                  <span className="text-sm font-semibold">{def.el}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {def.subs!.map((s) => (
                      <button key={s.key} type="button" aria-pressed={p.subs.includes(s.key)} onClick={() => toggleSub(p.key, s.key)} className={softChip(p.subs.includes(s.key))}>
                        {p.subs.includes(s.key) ? "✓ " : ""}{s.el}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            <p className="border-t border-line-softer pt-3 text-sm">
              <span className="text-muted">{t("chosen")}: </span>
              {v.procedures.length
                ? v.procedures.map((p) => {
                    const def = findProcedure(p.key);
                    const subs = p.subs.map((s) => def?.subs?.find((x) => x.key === s)?.el).filter(Boolean);
                    return subs.length ? `${def?.el} (${subs.join(", ")})` : def?.el;
                  }).join(" · ")
                : t("noneChosen")}
            </p>
            {surgical && <p className="rounded-[10px] bg-info-bg px-3 py-2 text-[13px] text-info-ink">{t("planningSoon")}</p>}
            <label className="block text-sm font-medium text-ink-2">{t("diagnosis")}
              <input value={v.diagnosis} onChange={(e) => set({ diagnosis: e.target.value })} className={inputClass} />
            </label>
          </section>
        </div>

        <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-4">
          <section className={`${card} flex flex-col gap-3 p-5`}>
            <h2 className="text-[17px] font-semibold">{t("vitals")}</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm text-ink-3">{t("weight")}
                <input value={v.weightKg} onChange={(e) => set({ weightKg: e.target.value })} inputMode="decimal" className={inputClass} />
              </label>
              <label className="block text-sm text-ink-3">{t("height")}
                <input value={v.heightCm} onChange={(e) => set({ heightCm: e.target.value })} inputMode="decimal" className={inputClass} />
              </label>
            </div>
            <div className="flex items-baseline justify-between rounded-[10px] bg-surface-2 px-3 py-2">
              <span className="text-sm text-muted">{t("bmiAuto")}</span>
              <span className="text-[17px] font-semibold">{num1(b)}</span>
            </div>
            {!v.weightKg && <span className="text-[13px] font-medium text-warn-ink">{t("weightPrompt")}</span>}
            {previousWeight && (
              <span className="text-[13px] text-muted">
                {t("previousWeight", { kg: num1(previousWeight.kg), date: previousWeight.date })}
                {weight > 0 && ` (${weight - previousWeight.kg > 0 ? "+" : ""}${num1(Math.round((weight - previousWeight.kg) * 10) / 10)} kg)`}
              </span>
            )}
          </section>
          {aside}
        </aside>
      </div>

      <div className="sticky bottom-20 z-20 flex flex-wrap gap-2 rounded-[14px] border border-line bg-surface-2/95 px-4 py-3 backdrop-blur md:bottom-3">
        <button type="button" onClick={save} disabled={pending} className={primaryButton}>{pending ? t("saving") : t("save")}</button>
      </div>
    </div>
  );
}
