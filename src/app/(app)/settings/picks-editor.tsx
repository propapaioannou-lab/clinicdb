"use client";

import { useTranslations } from "next-intl";
import { fieldClass } from "@/components/ui";

export type EditablePick = { key?: string; labelEl: string; labelEn: string; hidden?: boolean };

const arrow = "flex h-9 w-9 items-center justify-center rounded-[8px] border border-line-strong text-ink-3 hover:border-primary hover:text-primary disabled:opacity-30";

// Labelled options (history quick picks, procedure sub-options): Greek / English names,
// ↑ ↓ order, hide (saved ones) or remove (new ones), add.
export function PicksEditor({ value, onChange, title }: { value: EditablePick[]; onChange: (v: EditablePick[]) => void; title: string }) {
  const t = useTranslations("picksEditor");
  const set = (i: number, patch: Partial<EditablePick>) => onChange(value.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const move = (i: number, step: number) => {
    const list = [...value];
    [list[i], list[i + step]] = [list[i + step], list[i]];
    onChange(list);
  };
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold">{title}</span>
      {value.map((c, i) => (
        <div key={c.key ?? `new${i}`} className={`flex flex-wrap items-center gap-2 ${c.hidden ? "opacity-55" : ""}`}>
          <span className="flex gap-1">
            <button type="button" aria-label={t("up", { label: c.labelEl })} disabled={i === 0} onClick={() => move(i, -1)} className={arrow}>↑</button>
            <button type="button" aria-label={t("down", { label: c.labelEl })} disabled={i === value.length - 1} onClick={() => move(i, 1)} className={arrow}>↓</button>
          </span>
          <input value={c.labelEl} onChange={(e) => set(i, { labelEl: e.target.value })} aria-label={t("el")} placeholder={t("el")} className={`${fieldClass} min-w-0 flex-[1_1_200px]`} />
          <input value={c.labelEn} onChange={(e) => set(i, { labelEn: e.target.value })} aria-label={t("en")} placeholder={t("en")} className={`${fieldClass} min-w-0 flex-[1_1_160px]`} />
          {c.key ? (
            <button type="button" onClick={() => set(i, { hidden: !c.hidden })} className="min-h-9 px-2 text-[13.5px] font-semibold text-primary">
              {c.hidden ? t("show") : t("hide")}
            </button>
          ) : (
            <button type="button" aria-label={t("remove")} onClick={() => onChange(value.filter((_, j) => j !== i))} className="min-h-9 px-2 text-muted hover:text-danger">✕</button>
          )}
        </div>
      ))}
      <button type="button" onClick={() => onChange([...value, { labelEl: "", labelEn: "" }])} className="self-start text-[13.5px] font-semibold text-primary">
        + {t("add")}
      </button>
    </div>
  );
}
