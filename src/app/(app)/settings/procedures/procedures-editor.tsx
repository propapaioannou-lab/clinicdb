"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Badge, ErrorBox, inputClass, primaryButton, secondaryButton } from "@/components/ui";
import type { ProcedureState } from "../actions";
import { PicksEditor, type EditablePick } from "../picks-editor";

export type ProcedureRow = { id: string; labelEl: string; labelEn: string; nonSurgical: boolean; isActive: boolean; subs: EditablePick[] };
type Values = Omit<ProcedureRow, "id">;

const arrow = "flex h-9 w-9 items-center justify-center rounded-[8px] border border-line-strong text-ink-3 hover:border-primary hover:text-primary disabled:opacity-30";

function Editor({ initial, save, cancel, pending }: { initial: Values; save: (v: Values) => void; cancel: () => void; pending: boolean }) {
  const t = useTranslations("settingsProcedures");
  const [v, setV] = useState(initial);
  const set = (patch: Partial<Values>) => setV((x) => ({ ...x, ...patch }));
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save(v);
      }}
      className="flex flex-col gap-3 rounded-[12px] border border-primary/40 bg-surface-2 p-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm text-ink-3">{t("labelEl")}
          <input value={v.labelEl} onChange={(e) => set({ labelEl: e.target.value })} className={inputClass} />
        </label>
        <label className="block text-sm text-ink-3">{t("labelEn")}
          <input value={v.labelEn} onChange={(e) => set({ labelEn: e.target.value })} className={inputClass} />
        </label>
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={v.isActive} onChange={(e) => set({ isActive: e.target.checked })} className="h-4 w-4 accent-primary" />
          {t("active")}
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={v.nonSurgical} onChange={(e) => set({ nonSurgical: e.target.checked })} className="h-4 w-4 accent-primary" />
          {t("nonSurgical")}
        </label>
      </div>
      <PicksEditor title={t("subs")} value={v.subs} onChange={(subs) => set({ subs })} />
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending || !v.labelEl.trim()} className={primaryButton}>{t("save")}</button>
        <button type="button" onClick={cancel} className={secondaryButton}>{t("cancel")}</button>
      </div>
    </form>
  );
}

// One surgical area of the catalogue: ↑ ↓ order, inline edit, new procedure at the end.
export function ProceduresEditor({
  rows,
  add,
  update,
  move,
}: {
  rows: ProcedureRow[];
  add: (v: Values) => Promise<ProcedureState>;
  update: (id: string, v: Values) => Promise<ProcedureState>;
  move: (id: string, step: -1 | 1) => Promise<ProcedureState>;
}) {
  const t = useTranslations("settingsProcedures");
  const [editing, setEditing] = useState<string | null>(null);
  const [state, setState] = useState<ProcedureState>({});
  const [pending, start] = useTransition();
  const act = (fn: () => Promise<ProcedureState>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      setState(r);
      if (!r.error) after?.();
    });
  return (
    <div className="flex flex-col gap-2">
      {state.error && <ErrorBox>{t(`errors.${state.error}`)}</ErrorBox>}
      <ul className="flex flex-col divide-y divide-line-softer">
        {rows.map((r, i) =>
          editing === r.id ? (
            <li key={r.id} className="py-2">
              <Editor initial={r} pending={pending} cancel={() => setEditing(null)} save={(v) => act(() => update(r.id, v), () => setEditing(null))} />
            </li>
          ) : (
            <li key={r.id} className={`flex flex-wrap items-center gap-2 py-2 ${r.isActive ? "" : "opacity-55"}`}>
              <span className="flex gap-1">
                <button type="button" aria-label={t("up", { label: r.labelEl })} disabled={pending || i === 0} onClick={() => act(() => move(r.id, -1))} className={arrow}>↑</button>
                <button type="button" aria-label={t("down", { label: r.labelEl })} disabled={pending || i === rows.length - 1} onClick={() => act(() => move(r.id, 1))} className={arrow}>↓</button>
              </span>
              <span className="flex min-w-0 flex-[1_1_260px] flex-wrap items-center gap-1.5">
                <span className="text-[15px]">{r.labelEl}</span>
                {!r.isActive && <Badge tone="neutral">{t("hidden")}</Badge>}
                {r.nonSurgical && <Badge tone="neutral">{t("nonSurgicalShort")}</Badge>}
                {r.subs.some((s) => !s.hidden) && <span className="text-[12.5px] text-muted">{t("subCount", { count: r.subs.filter((s) => !s.hidden).length })}</span>}
              </span>
              <button type="button" onClick={() => setEditing(r.id)} className="min-h-9 px-2 text-[13.5px] font-semibold text-primary hover:text-primary-hover">{t("edit")}</button>
            </li>
          ),
        )}
      </ul>
      {editing === "new" ? (
        <Editor
          initial={{ labelEl: "", labelEn: "", nonSurgical: false, isActive: true, subs: [] }}
          pending={pending}
          cancel={() => setEditing(null)}
          save={(v) => act(() => add(v), () => setEditing(null))}
        />
      ) : (
        <button type="button" onClick={() => setEditing("new")} className="self-start text-[13.5px] font-semibold text-primary">+ {t("add")}</button>
      )}
    </div>
  );
}
