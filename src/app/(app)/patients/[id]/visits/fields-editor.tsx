"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { fieldClass } from "@/components/ui";
import { fieldShown, type Field, type FieldValue, type FindingValue, type MeasureValue } from "@/lib/visits/exams/engine";

export const opt = (on: boolean) =>
  `min-h-9 rounded-full px-3 py-1 text-[13px] ${on ? "border border-primary bg-primary-tint font-semibold text-primary" : "border border-line-strong bg-surface text-ink-3 hover:border-primary"}`;

const shown = (n: number | undefined) => (n === undefined ? "" : String(n).replace(".", ","));
const parse = (s: string) => {
  const n = Number(s.replace(",", "."));
  return s.trim() && Number.isFinite(n) ? n : undefined;
};

// One number box. While focused it shows what is typed (so "21," survives); otherwise
// it shows the stored value, so two boxes for the same number (table and sketch) agree.
export function NumberBox({ value, onChange, label, placeholder, className }: { value: number | undefined; onChange: (n: number | undefined) => void; label: string; placeholder?: string; className: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      value={draft ?? shown(value)}
      onFocus={() => setDraft(shown(value))}
      onBlur={() => setDraft(null)}
      onChange={(e) => {
        setDraft(e.target.value);
        onChange(parse(e.target.value));
      }}
      inputMode="decimal"
      aria-label={label}
      placeholder={placeholder}
      className={className}
    />
  );
}

export const putSide = (value: MeasureValue | undefined, k: keyof MeasureValue, n: number | undefined) => {
  const next = { ...(value ?? {}) };
  if (n === undefined) delete next[k];
  else next[k] = n;
  return Object.keys(next).length ? next : undefined;
};

// Number inputs for one measurement: one box, or Δ / Α boxes. With `choices` (e.g. an
// implant size chart) each box is a list to pick from instead.
export function MeasureInputs({
  field,
  value,
  onChange,
  compact,
  choices,
}: {
  field: Extract<Field, { type: "measure" }>;
  value: MeasureValue | undefined;
  onChange: (v: MeasureValue | undefined) => void;
  compact?: boolean;
  choices?: { value: number; label: string }[];
}) {
  const t = useTranslations("exam");
  const box = (k: keyof MeasureValue, label: string) =>
    choices ? (
      <label className="flex items-center gap-1 text-[13px] text-muted">
        {label}
        <select
          value={value?.[k] ?? ""}
          onChange={(e) => onChange(putSide(value, k, e.target.value === "" ? undefined : Number(e.target.value)))}
          aria-label={`${field.el}${label ? ` ${label}` : ""}`}
          className={`${fieldClass} min-w-[150px]`}
        >
          <option value="">—</option>
          {/* A size typed earlier that is not in the chart stays visible. */}
          {value?.[k] !== undefined && !choices.some((c) => c.value === value[k]) && <option value={value[k]}>{value[k]}</option>}
          {choices.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </label>
    ) : (
    <label className="flex items-center gap-1 text-[13px] text-muted">
      {label}
      <NumberBox
        value={value?.[k]}
        onChange={(n) => onChange(putSide(value, k, n))}
        label={`${field.el}${label ? ` ${label}` : ""}`}
        className={compact ? "h-9 w-14 rounded-control border border-line-strong bg-surface px-1 text-center text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-tint" : `${fieldClass} w-[72px] text-center`}
      />
    </label>
    );
  return (
    <span className="flex flex-wrap items-center gap-2">
      {field.sides ? <>{box("r", t("right"))}{box("l", t("left"))}</> : box("v", "")}
      {field.unit && !compact && !choices && <span className="text-[13px] text-muted">{field.unit}</span>}
    </span>
  );
}

// The details of one finding or procedure: yes/no chips in one row, then one row per
// multiple-choice or measurement field. Fields with `showIf` appear once their condition holds.
export function FieldsEditor({
  label,
  fields,
  value,
  onField,
  choicesFor,
}: {
  label: string;
  fields: Field[];
  value: FindingValue;
  onField: (field: string, update: (prev: FieldValue | undefined) => FieldValue | undefined) => void;
  // Pick-from lists for measurement fields (implant sizes from the chart).
  choicesFor?: (field: string) => { value: number; label: string }[] | undefined;
}) {
  const visible = fields.filter((f) => fieldShown(f, value));
  const bools = visible.filter((x) => x.type === "bool");
  return (
    <>
      {bools.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {bools.map((field) => (
            <button key={field.key} type="button" aria-pressed={value[field.key] === true} onClick={() => onField(field.key, (p) => !p)} className={opt(value[field.key] === true)}>
              {value[field.key] === true ? "✓ " : ""}{field.el}
            </button>
          ))}
        </div>
      )}
      {visible.filter((x): x is Exclude<Field, { type: "bool" }> => x.type !== "bool").map((field) => {
        const v = value[field.key];
        return (
          <div key={field.key} role="group" aria-label={`${label}: ${field.el}`} className="flex flex-wrap items-center gap-1.5">
            <span className="w-28 shrink-0 text-[13px] text-muted">{field.el}</span>
            {field.type === "measure" ? (
              <MeasureInputs field={field} value={v as MeasureValue | undefined} onChange={(m) => onField(field.key, () => m)} choices={choicesFor?.(field.key)} />
            ) : (
              field.options.map((o) => {
                const on = field.type === "one" ? v === o.key : Array.isArray(v) && v.includes(o.key);
                return (
                  <button
                    key={o.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      onField(field.key, (p) =>
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
              })
            )}
          </div>
        );
      })}
    </>
  );
}
