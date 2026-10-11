"use client";

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

// Number inputs for one measurement: one box, or Δ / Α boxes. Uncontrolled so a half-typed
// "21," is not rewritten while typing.
export function MeasureInputs({ field, value, onChange }: { field: Extract<Field, { type: "measure" }>; value: MeasureValue | undefined; onChange: (v: MeasureValue | undefined) => void }) {
  const t = useTranslations("exam");
  const put = (k: keyof MeasureValue, s: string) => {
    const next = { ...(value ?? {}) };
    const n = parse(s);
    if (n === undefined) delete next[k];
    else next[k] = n;
    onChange(Object.keys(next).length ? next : undefined);
  };
  const box = (k: keyof MeasureValue, label: string) => (
    <label className="flex items-center gap-1 text-[13px] text-muted">
      {label}
      <input defaultValue={shown(value?.[k])} onChange={(e) => put(k, e.target.value)} inputMode="decimal" aria-label={`${field.el}${label ? ` ${label}` : ""}`} className={`${fieldClass} w-[72px] text-center`} />
    </label>
  );
  return (
    <span className="flex flex-wrap items-center gap-2">
      {field.sides ? <>{box("r", t("right"))}{box("l", t("left"))}</> : box("v", "")}
      {field.unit && <span className="text-[13px] text-muted">{field.unit}</span>}
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
}: {
  label: string;
  fields: Field[];
  value: FindingValue;
  onField: (field: string, update: (prev: FieldValue | undefined) => FieldValue | undefined) => void;
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
              <MeasureInputs field={field} value={v as MeasureValue | undefined} onChange={(m) => onField(field.key, () => m)} />
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
