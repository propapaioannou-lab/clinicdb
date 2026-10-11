"use client";

import { useTranslations } from "next-intl";
import { fieldClass } from "@/components/ui";
import {
  BREAST_FINDINGS,
  BREAST_PREVIOUS,
  difficultyModifiers,
  type BreastExam as Exam,
  type FindingValue,
} from "@/lib/visits/exams/breast";

const pill = (on: boolean) =>
  `min-h-10 rounded-full px-3.5 py-1.5 text-sm ${on ? "border border-primary bg-primary font-semibold text-white" : "border border-line-strong bg-surface text-ink-2 hover:border-primary"}`;
const opt = (on: boolean) =>
  `min-h-9 rounded-full px-3 py-1 text-[13px] ${on ? "border border-primary bg-primary-tint font-semibold text-primary" : "border border-line-strong bg-surface text-ink-3 hover:border-primary"}`;

// Structured breast examination: tap a finding, answer its options; the sentences are
// written into "Επιπλέον ευρήματα" below, where they stay editable (decided 11 Oct 2026). The surgeon never sees money, so difficulty
// shows only the extra time; the fee modifier is applied in the quote.
export function BreastExam({
  value,
  onChange,
}: {
  value: Exam | undefined;
  onChange: (update: (prev: Exam) => Exam) => void;
}) {
  const t = useTranslations("breastExam");
  const exam: Exam = value ?? { findings: {} };
  const revision = !!exam.revision;
  const findings = BREAST_FINDINGS.filter((f) => !f.revisionOnly || revision);
  const extra = difficultyModifiers(exam.difficulty).extraMinutes;

  const toggleFinding = (key: string) =>
    onChange((p) => {
      const next = { ...p.findings };
      if (key in next) delete next[key];
      else next[key] = {};
      return { ...p, findings: next };
    });
  const setField = (finding: string, field: string, update: (prev: FindingValue[string] | undefined) => FindingValue[string] | undefined) =>
    onChange((p) => {
      const current = { ...(p.findings[finding] ?? {}) };
      const v = update(current[field]);
      if (v === undefined || v === false || (Array.isArray(v) && !v.length)) delete current[field];
      else current[field] = v;
      return { ...p, findings: { ...p.findings, [finding]: current } };
    });
  const toggleRevision = () =>
    onChange((p) => {
      if (p.revision) {
        const rest = { ...p.findings };
        delete rest.implants;
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
              {BREAST_PREVIOUS.map((p) => {
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
                <span className="min-w-40">{BREAST_PREVIOUS.find((x) => x.key === p.key)?.el}</span>
                <input value={p.year ?? ""} onChange={(e) => setYear(p.key, e.target.value)} placeholder={t("year")} inputMode="numeric" className={`${fieldClass} w-28`} />
              </label>
            ))}
          </>
        )}
      </div>

      <div>
        <span className="mb-1.5 block text-[13px] font-medium text-muted">{t("findings")}</span>
        <div className="flex flex-wrap gap-2">
          {findings.map((f) => (
            <button key={f.key} type="button" aria-pressed={f.key in exam.findings} onClick={() => toggleFinding(f.key)} className={pill(f.key in exam.findings)}>
              {f.key in exam.findings ? "✓ " : "+ "}{f.el}
            </button>
          ))}
        </div>
      </div>

      {findings.filter((f) => f.key in exam.findings).map((f) => (
        <div key={f.key} className="flex flex-col gap-2 rounded-[10px] border border-line-soft bg-surface px-3 py-2.5">
          <span className="text-sm font-semibold">{f.el}</span>
          {f.fields.some((x) => x.type === "bool") && (
            <div className="flex flex-wrap gap-1.5">
              {f.fields.filter((x) => x.type === "bool").map((field) => {
                const v = exam.findings[f.key]?.[field.key];
                return (
                  <button key={field.key} type="button" aria-pressed={v === true} onClick={() => setField(f.key, field.key, (p) => !p)} className={opt(v === true)}>
                    {v === true ? "✓ " : ""}{field.el}
                  </button>
                );
              })}
            </div>
          )}
          {f.fields.filter((x) => x.type !== "bool").map((field) => {
            const v = exam.findings[f.key]?.[field.key];
            return (
              <div key={field.key} role="group" aria-label={`${f.el}: ${field.el}`} className="flex flex-wrap items-center gap-1.5">
                <span className="w-24 shrink-0 text-[13px] text-muted">{field.el}</span>
                {field.options!.map((o) => {
                  const on = field.type === "one" ? v === o.key : Array.isArray(v) && v.includes(o.key);
                  return (
                    <button
                      key={o.key}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        setField(f.key, field.key, (p) =>
                          field.type === "one"
                            ? p === o.key ? undefined : o.key
                            : Array.isArray(p) && p.includes(o.key) ? p.filter((x) => x !== o.key) : [...(Array.isArray(p) ? p : []), o.key],
                        )
                      }
                      className={opt(on)}
                    >
                      {o.el}
                    </button>
                  );
                })}
              </div>
            );
          })}
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
