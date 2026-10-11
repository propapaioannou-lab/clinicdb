"use client";

import { useTranslations } from "next-intl";
import { fieldClass } from "@/components/ui";
import { difficultyModifiers, type AreaExam, type ExamValue as Exam, type FieldValue, type MeasureValue } from "@/lib/visits/exams/engine";
import { FieldsEditor, MeasureInputs, opt } from "./fields-editor";

const pill = (on: boolean) =>
  `min-h-10 rounded-full px-3.5 py-1.5 text-sm ${on ? "border border-primary bg-primary font-semibold text-white" : "border border-line-strong bg-surface text-ink-2 hover:border-primary"}`;

// Structured examination of one area (decided 11 Oct 2026): tap a finding, answer its
// options; the sentences are written into "Επιπλέον ευρήματα", where they stay editable.
// The surgeon never sees money, so difficulty shows only the extra time.
export function ExamPanel({
  area,
  value,
  onChange,
  missing = [],
}: {
  area: AreaExam;
  value: Exam | undefined;
  onChange: (update: (prev: Exam) => Exam) => void;
  // Measurements still needed for the chosen procedures (breast).
  missing?: string[];
}) {
  const t = useTranslations("exam");
  const exam: Exam = value ?? { findings: {} };
  const revision = !!exam.revision;
  const findings = area.findings.filter((f) => !f.revisionOnly || revision);
  const groups = [undefined, ...(area.groups ?? [])];
  const extra = difficultyModifiers(exam.difficulty).extraMinutes;

  const toggleFinding = (key: string) =>
    onChange((p) => {
      const next = { ...p.findings };
      if (key in next) delete next[key];
      else next[key] = {};
      return { ...p, findings: next };
    });
  const setField = (finding: string, field: string, update: (prev: FieldValue | undefined) => FieldValue | undefined) =>
    onChange((p) => {
      const current = { ...(p.findings[finding] ?? {}) };
      const v = update(current[field]);
      if (v === undefined || v === false || (Array.isArray(v) && !v.length)) delete current[field];
      else current[field] = v;
      return { ...p, findings: { ...p.findings, [finding]: current } };
    });
  const setMeasurement = (key: string, v: MeasureValue | undefined) =>
    onChange((p) => {
      const m = { ...(p.measurements ?? {}) };
      if (v) m[key] = v;
      else delete m[key];
      return { ...p, measurements: Object.keys(m).length ? m : undefined };
    });
  const toggleRevision = () =>
    onChange((p) => {
      if (p.revision) {
        const rest = { ...p.findings };
        for (const f of area.findings) if (f.revisionOnly) delete rest[f.key];
        return { ...p, revision: undefined, findings: rest };
      }
      return { ...p, revision: { previous: [] } };
    });
  const togglePrevious = (key: string) =>
    onChange((p) => {
      const prev = p.revision?.previous ?? [];
      return { ...p, revision: { previous: prev.some((x) => x.key === key) ? prev.filter((x) => x.key !== key) : [...prev, { key }] } };
    });
  const setYear = (key: string, year: string) =>
    onChange((p) => ({ ...p, revision: { previous: (p.revision?.previous ?? []).map((x) => (x.key === key ? { ...x, year } : x)) } }));

  const missingNames = missing.map((k) => area.measurements?.fields.find((f) => f.key === k)?.el).filter(Boolean);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 rounded-[10px] border border-line-soft bg-surface px-3 py-2.5">
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={revision} onChange={toggleRevision} className="h-4 w-4 accent-primary" />
          {t("revision")}
        </label>
        {revision && (
          <>
            <span className="text-[13px] text-muted">{t("previous")}</span>
            <div className="flex flex-wrap gap-1.5">
              {area.previous.map((p) => {
                const on = exam.revision!.previous.some((x) => x.key === p.key);
                return (
                  <button key={p.key} type="button" aria-pressed={on} onClick={() => togglePrevious(p.key)} className={opt(on)}>
                    {on ? "✓ " : ""}{p.el}
                  </button>
                );
              })}
            </div>
            {exam.revision!.previous.map((p) => (
              <label key={p.key} className="flex flex-wrap items-center gap-2 text-sm text-ink-3">
                <span className="min-w-40">{area.previous.find((x) => x.key === p.key)?.el}</span>
                <input value={p.year ?? ""} onChange={(e) => setYear(p.key, e.target.value)} placeholder={t("year")} inputMode="numeric" className={`${fieldClass} w-28`} />
              </label>
            ))}
          </>
        )}
      </div>

      {area.measurements && (
        <div className={`flex flex-col gap-2 rounded-[10px] border px-3 py-2.5 ${missingNames.length ? "border-warn-line bg-warn-bg/40" : "border-line-soft bg-surface"}`}>
          <span className="text-sm font-semibold">{area.measurements.title}</span>
          {missingNames.length > 0 && <span role="status" className="text-[13px] font-medium text-warn-ink">{t("requiredMissing", { list: missingNames.join(", ") })}</span>}
          <div className="flex flex-col gap-2">
            {area.measurements.fields.map((f) =>
              f.type !== "measure" ? null : (
                <div key={f.key} className="flex flex-wrap items-center gap-2">
                  <span className={`w-44 shrink-0 text-[13px] ${missing.includes(f.key) ? "font-semibold text-warn-ink" : "text-ink-3"}`}>{f.el}</span>
                  <MeasureInputs field={f} value={exam.measurements?.[f.key]} onChange={(v) => setMeasurement(f.key, v)} />
                </div>
              ),
            )}
          </div>
          {area.measurements.note && <span className="text-[12.5px] text-muted">{area.measurements.note}</span>}
        </div>
      )}

      {groups.map((g) => {
        const list = findings.filter((f) => f.group === g);
        if (!list.length) return null;
        return (
          <div key={g ?? "main"}>
            <span className="mb-1.5 block text-[13px] font-medium text-muted">{g ?? t("findings")}</span>
            <div className="flex flex-wrap gap-2">
              {list.map((f) => (
                <button key={f.key} type="button" aria-pressed={f.key in exam.findings} onClick={() => toggleFinding(f.key)} className={pill(f.key in exam.findings)}>
                  {f.key in exam.findings ? "✓ " : "+ "}{f.el}
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {findings.filter((f) => f.key in exam.findings).map((f) => (
        <div key={f.key} className="flex flex-col gap-2 rounded-[10px] border border-line-soft bg-surface px-3 py-2.5">
          <span className="text-sm font-semibold">{f.el}</span>
          <FieldsEditor label={f.el} fields={f.fields} value={exam.findings[f.key] ?? {}} onField={(field, u) => setField(f.key, field, u)} />
        </div>
      ))}

      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-muted">{t("difficulty")}</span>
        <div role="radiogroup" aria-label={t("difficulty")} className="flex flex-wrap items-center gap-1.5">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={exam.difficulty === n}
              onClick={() => onChange((p) => ({ ...p, difficulty: p.difficulty === n ? undefined : n }))}
              className={`h-10 w-10 rounded-full text-sm ${exam.difficulty === n ? "bg-primary font-semibold text-white" : "border border-line-strong bg-surface text-ink-2 hover:border-primary"}`}
            >
              {n}
            </button>
          ))}
          {exam.difficulty && <span className="ml-1 text-[13px] text-ink-3">{extra ? t("extraTime", { minutes: extra }) : t("standard")}</span>}
        </div>
      </div>
    </div>
  );
}
