"use client";

import { num1 } from "@/lib/format";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { PlusIcon } from "@/components/icons";
import { card, ErrorBox, inputClass, Notice, primaryButton, textareaClass } from "@/components/ui";
import { bmi } from "@/lib/history/data";
import { EXAM_AREAS, PROCEDURE_AREAS, findProcedure } from "@/lib/visits/catalog";
import type { VisitArea, VisitProcedure } from "@/lib/visits/visits";
import { EXAMS, missingMeasurements, requiredBreastMeasurements } from "@/lib/visits/exams/areas";
import { summarize, type ExamValue, type FieldValue } from "@/lib/visits/exams/engine";
import { chartFor, detailsPhrase, PROCEDURE_DETAILS } from "@/lib/visits/procedure-details";
import type { VisitActionState } from "./actions";
import { ExamPanel } from "./exam-panel";
import { FieldsEditor } from "./fields-editor";

export type VisitFormValues = {
  typeId: string;
  date: string; // dd/mm/yyyy, Athens
  time: string; // HH:MM
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
  age,
  sex,
}: {
  types: { id: string; label: string }[];
  initial: VisitFormValues;
  previousWeight: { kg: number; date: string } | null;
  action: (json: string) => Promise<VisitActionState>;
  aside?: React.ReactNode;
  // Patient's age today, for the written-up findings.
  age: number | null;
  // Patient's recorded gender: picks the breast/chest findings offered.
  sex: string | null;
}) {
  const t = useTranslations("visit");
  const [v, setV] = useState<VisitFormValues>(initial);
  // Open areas of the preoperative assessment: those with chosen procedures, plus any the
  // doctor opened; ✕ closes an area and unselects its procedures.
  const [procAreas, setProcAreas] = useState<string[]>(() =>
    PROCEDURE_AREAS.filter((a) => a.procedures.some((p) => initial.procedures.some((x) => x.key === p.key))).map((a) => a.key),
  );
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
  const closeProcArea = (area: string) => {
    const keys = new Set(PROCEDURE_AREAS.find((a) => a.key === area)!.procedures.map((p) => p.key));
    setProcAreas((x) => x.filter((a) => a !== area));
    setV((x) => ({ ...x, procedures: x.procedures.filter((p) => !keys.has(p.key)) }));
  };
  const setDetail = (key: string, field: string, update: (prev: FieldValue | undefined) => FieldValue | undefined) =>
    setV((x) => ({
      ...x,
      procedures: x.procedures.map((p) => {
        if (p.key !== key) return p;
        const details = { ...(p.details ?? {}) };
        const val = update(details[field]);
        if (val === undefined || val === false || (Array.isArray(val) && !val.length)) delete details[field];
        else details[field] = val;
        return { ...p, details };
      }),
    }));
  const addArea = (area: string) => setV((x) => ({ ...x, areas: [...x.areas, { area, text: "" }] }));
  const removeArea = (area: string) => setV((x) => ({ ...x, areas: x.areas.filter((a) => a.area !== area) }));
  const setAreaText = (area: string, text: string) => setV((x) => ({ ...x, areas: x.areas.map((a) => (a.area === area ? { ...a, text } : a)) }));
  // The written-up findings land in "Επιπλέον ευρήματα" and follow the taps until the
  // doctor edits the text; after that the text is theirs (the ↻ button rewrites it).
  const summary = (area: string, exam: ExamValue) => summarize(EXAMS[area], exam, age);
  const setAreaExam = (area: string, update: (prev: ExamValue) => ExamValue) =>
    setV((x) => ({
      ...x,
      areas: x.areas.map((a) => {
        if (a.area !== area) return a;
        const before = a.exam ?? { findings: {} };
        const exam = update(before);
        const following = !a.text.trim() || a.text === summary(area, before);
        return { ...a, exam, text: following ? summary(area, exam) : a.text };
      }),
    }));
  const rewrite = (area: string) =>
    setV((x) => ({ ...x, areas: x.areas.map((a) => (a.area === area && a.exam ? { ...a, text: summary(area, a.exam) } : a)) }));
  const required = requiredBreastMeasurements(v.procedures.map((p) => p.key));

  const payload = () =>
    JSON.stringify({
      typeId: v.typeId || null,
      date: v.date,
      time: v.time,
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
            {v.areas.map((a) => {
              const def = EXAM_AREAS.find((d) => d.key === a.area)!;
              return (
                <div key={a.area} aria-label={t("areaLabel", { area: def.el })} className="flex flex-col gap-2 rounded-[12px] border border-line-soft bg-surface-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-[15px] font-semibold">{def.el}</h3>
                    <button type="button" onClick={() => removeArea(a.area)} aria-label={t("removeArea", { area: def.el })} className="text-sm text-muted hover:text-danger">✕</button>
                  </div>
                  {EXAMS[a.area] && (
                    <ExamPanel
                      area={EXAMS[a.area]}
                      value={a.exam}
                      onChange={(u) => setAreaExam(a.area, u)}
                      missing={a.area === "breast" ? missingMeasurements(a.exam, required) : []}
                      sex={sex}
                    />
                  )}
                  <label className="block text-[13px] font-medium text-muted">
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      {t("findingsText")}
                      {a.exam && a.text !== summary(a.area, a.exam) && summary(a.area, a.exam) && (
                        <button type="button" onClick={() => rewrite(a.area)} className="text-[13px] font-semibold text-primary hover:text-primary-hover">
                          ↻ {t("rewrite")}
                        </button>
                      )}
                    </span>
                    <textarea rows={4} value={a.text} onChange={(e) => setAreaText(a.area, e.target.value)} aria-label={`${def.el}: ${t("findingsText")}`} className={`${textareaClass} text-[15px] leading-relaxed`} />
                  </label>
                </div>
              );
            })}
          </section>

          <section className={`${card} flex flex-col gap-3 p-5`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[17px] font-semibold">{t("procedures")}</h2>
              <div role="group" aria-label={t("addArea")} className="flex flex-wrap gap-2">
                {PROCEDURE_AREAS.filter((a) => !procAreas.includes(a.key)).map((a) => (
                  <button key={a.key} type="button" onClick={() => setProcAreas((x) => [...x, a.key])} className="inline-flex min-h-9 items-center gap-1 rounded-full border border-dashed border-line-strong px-3 text-[13px] text-ink-3 hover:border-primary hover:text-primary">
                    <PlusIcon size={14} />{a.el}
                  </button>
                ))}
              </div>
            </div>
            {PROCEDURE_AREAS.filter((a) => procAreas.includes(a.key)).map((area) => (
              <div key={area.key} aria-label={t("procedureAreaLabel", { area: area.el })} className="flex flex-col gap-3 rounded-[12px] border border-line-soft bg-surface-2 p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-[15px] font-semibold">{area.el}</h3>
                  <button type="button" onClick={() => closeProcArea(area.key)} aria-label={t("removeArea", { area: area.el })} className="text-sm text-muted hover:text-danger">✕</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {area.procedures.map((p) => (
                    <button key={p.key} type="button" aria-pressed={chosen.has(p.key)} onClick={() => toggleProcedure(p.key)} className={chip(chosen.has(p.key))}>
                      {chosen.has(p.key) ? "✓ " : "+ "}{p.el}
                    </button>
                  ))}
                </div>
                {v.procedures.filter((p) => area.procedures.some((x) => x.key === p.key) && (findProcedure(p.key)?.subs || PROCEDURE_DETAILS[p.key])).map((p) => {
                  const def = findProcedure(p.key)!;
                  const details = PROCEDURE_DETAILS[p.key];
                  const chart = details ? chartFor(p.details ?? {}) : [];
                  return (
                    <div key={p.key} className="flex flex-col gap-2 rounded-[10px] border border-line-soft bg-surface px-3 py-2.5">
                      <span className="text-sm font-semibold">{def.el}</span>
                      {def.subs && (
                        <div className="flex flex-wrap gap-1.5">
                          {def.subs.map((s) => (
                            <button key={s.key} type="button" aria-pressed={p.subs.includes(s.key)} onClick={() => toggleSub(p.key, s.key)} className={softChip(p.subs.includes(s.key))}>
                              {p.subs.includes(s.key) ? "✓ " : ""}{s.el}
                            </button>
                          ))}
                        </div>
                      )}
                      {details && <FieldsEditor label={def.el} fields={details.fields} value={p.details ?? {}} onField={(field, u) => setDetail(p.key, field, u)} />}
                      {chart.length > 0 && (
                        <div role="group" aria-label={t("sizeChart")} className="flex flex-wrap items-center gap-1.5">
                          <span className="w-28 shrink-0 text-[13px] text-muted">{t("sizeChart")}</span>
                          {chart.map((row) => (
                            <button
                              key={row.cc}
                              type="button"
                              onClick={() => {
                                setDetail(p.key, "cc", () => ({ r: row.cc, l: row.cc }));
                                setDetail(p.key, "diameter", () => ({ r: row.diameter, l: row.diameter }));
                                setDetail(p.key, "projection", () => ({ r: row.projection, l: row.projection }));
                              }}
                              className={softChip(false)}
                            >
                              {row.cc} cc · {num1(row.diameter)} × {num1(row.projection)}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
            <p className="border-t border-line-softer pt-3 text-sm">
              <span className="text-muted">{t("chosen")}: </span>
              {v.procedures.length
                ? v.procedures.map((p) => {
                    const def = findProcedure(p.key);
                    const subs = p.subs.map((s) => def?.subs?.find((x) => x.key === s)?.el).filter(Boolean);
                    const spec = detailsPhrase(p.key, p.details);
                    return `${def?.el}${subs.length ? ` (${subs.join(", ")})` : ""}${spec ? `: ${spec}` : ""}`;
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
