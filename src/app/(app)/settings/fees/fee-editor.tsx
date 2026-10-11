"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { ErrorBox, fieldClass, Notice, secondaryButton } from "@/components/ui";
import type { SettingsState } from "../actions";

type Row = { id: string; label: string; chargeable: boolean; fee: string };

export function FeeEditor({ items, save }: { items: Row[]; save: (id: string, chargeable: boolean, fee: string) => Promise<SettingsState> }) {
  const t = useTranslations("settingsFees");
  const [rows, setRows] = useState(items);
  const [state, setState] = useState<SettingsState & { saved?: string }>({});
  const [pending, start] = useTransition();
  const set = (id: string, patch: Partial<Row>) => setRows((x) => x.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  return (
    <div className="flex flex-col gap-3">
      {state.error && <ErrorBox>{t(`errors.${state.error}`)}</ErrorBox>}
      {state.saved && !state.error && <Notice>{t("saved", { label: state.saved })}</Notice>}
      <ul className="flex flex-col divide-y divide-line-softer">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
            <span className="min-w-0 flex-[1_1_200px] text-[15px] font-medium">{r.label}</span>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={r.chargeable} onChange={(e) => set(r.id, { chargeable: e.target.checked })} className="h-4 w-4 accent-primary" />
              {t("chargeable")}
            </label>
            <label className="flex items-center gap-1.5 text-sm text-ink-3">
              <input value={r.fee} onChange={(e) => set(r.id, { fee: e.target.value })} inputMode="decimal" aria-label={t("fee", { label: r.label })} disabled={!r.chargeable} className={`${fieldClass} w-28 text-right`} />
              €
            </label>
            <button
              type="button"
              disabled={pending}
              onClick={() => start(async () => setState({ ...(await save(r.id, r.chargeable, r.chargeable ? r.fee : "")), saved: r.label }))}
              className={secondaryButton}
            >
              {t("save")}
            </button>
          </li>
        ))}
      </ul>
      <p className="text-[13px] text-muted">{t("note")}</p>
    </div>
  );
}
