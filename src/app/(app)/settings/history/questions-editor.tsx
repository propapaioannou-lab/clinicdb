"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Badge, card, ErrorBox, inputClass, primaryButton, secondaryButton } from "@/components/ui";
import type { QuestionState } from "../actions";
import { PicksEditor, type EditablePick } from "../picks-editor";

export type QuestionRow = {
  id: string;
  key: string;
  section: string;
  labelEl: string;
  labelEn: string;
  detailEl: string | null;
  detailEn: string | null;
  hintEl: string | null;
  hintEn: string | null;
  sensitive: boolean;
  infection: boolean;
  isActive: boolean;
  choices: EditablePick[];
};

const arrow = "flex h-9 w-9 items-center justify-center rounded-[8px] border border-line-strong text-ink-3 hover:border-primary hover:text-primary disabled:opacity-30";

function Editor({
  initial,
  sections,
  save,
  cancel,
  pending,
}: {
  initial: Omit<QuestionRow, "id" | "key">;
  sections: string[];
  save: (v: Omit<QuestionRow, "id" | "key">) => void;
  cancel: () => void;
  pending: boolean;
}) {
  const t = useTranslations("settingsHistory");
  const th = useTranslations("history");
  const [v, setV] = useState(initial);
  const set = (patch: Partial<typeof v>) => setV((x) => ({ ...x, ...patch }));
  const field = (k: "labelEl" | "labelEn" | "detailEl" | "detailEn" | "hintEl" | "hintEn", wide = false) => (
    <label className={`block text-sm text-ink-3 ${wide ? "sm:col-span-2" : ""}`}>{t(`fields.${k}`)}
      <input value={v[k] ?? ""} onChange={(e) => set({ [k]: e.target.value })} className={inputClass} />
    </label>
  );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save(v);
      }}
      className="flex flex-col gap-3 rounded-[12px] border border-primary/40 bg-surface-2 p-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {field("labelEl", true)}
        {field("detailEl")}
        {field("hintEl")}
        <label className="block text-sm text-ink-3">{t("fields.section")}
          <select value={v.section} onChange={(e) => set({ section: e.target.value })} className={inputClass}>
            {sections.map((s) => <option key={s} value={s}>{th(`sections.${s}` as "sections.heart")}</option>)}
          </select>
        </label>
        <div className="flex flex-col justify-end gap-2 text-sm">
          {(["isActive", "sensitive", "infection"] as const).map((k) => (
            <label key={k} className="flex items-center gap-2">
              <input type="checkbox" checked={v[k]} onChange={(e) => set({ [k]: e.target.checked })} className="h-4 w-4 accent-primary" />
              {t(`flags.${k}`)}
            </label>
          ))}
        </div>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-[13px] font-semibold text-muted">{t("english")}</summary>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {field("labelEn", true)}
          {field("detailEn")}
          {field("hintEn")}
        </div>
      </details>
      <PicksEditor title={t("picks")} value={v.choices} onChange={(choices) => set({ choices })} />
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending || !v.labelEl.trim()} className={primaryButton}>{t("save")}</button>
        <button type="button" onClick={cancel} className={secondaryButton}>{t("cancel")}</button>
      </div>
    </form>
  );
}

// Ρυθμίσεις → Ιατρικό ιστορικό: questions by section, in the order the form shows them.
export function QuestionsEditor({
  questions,
  sections,
  add,
  update,
  move,
}: {
  questions: QuestionRow[];
  sections: string[];
  add: (v: Omit<QuestionRow, "id" | "key">) => Promise<QuestionState>;
  update: (id: string, v: Omit<QuestionRow, "id" | "key">) => Promise<QuestionState>;
  move: (id: string, step: -1 | 1) => Promise<QuestionState>;
}) {
  const t = useTranslations("settingsHistory");
  const th = useTranslations("history");
  const [editing, setEditing] = useState<string | null>(null);
  const [state, setState] = useState<QuestionState>({});
  const [pending, start] = useTransition();
  const act = (fn: () => Promise<QuestionState>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      setState(r);
      if (!r.error) after?.();
    });
  const blank = (section: string): Omit<QuestionRow, "id" | "key"> => ({
    section, labelEl: "", labelEn: "", detailEl: "", detailEn: "", hintEl: "", hintEn: "", sensitive: false, infection: false, isActive: true, choices: [],
  });

  return (
    <div className="flex flex-col gap-4">
      {state.error && <ErrorBox>{t(`errors.${state.error}`)}</ErrorBox>}
      {sections.map((s) => {
        const list = questions.filter((q) => q.section === s);
        return (
          <section key={s} className={`${card} flex flex-col gap-2 p-5`}>
            <h2 className="text-[17px] font-semibold">{th(`sections.${s}` as "sections.heart")}</h2>
            <ul className="flex flex-col divide-y divide-line-softer">
              {list.map((q, i) =>
                editing === q.id ? (
                  <li key={q.id} className="py-2">
                    <Editor initial={q} sections={sections} pending={pending} cancel={() => setEditing(null)} save={(v) => act(() => update(q.id, v), () => setEditing(null))} />
                  </li>
                ) : (
                  <li key={q.id} className={`flex flex-wrap items-center gap-2 py-2 ${q.isActive ? "" : "opacity-55"}`}>
                    <span className="flex gap-1">
                      <button type="button" aria-label={t("up", { label: q.labelEl })} disabled={pending || i === 0} onClick={() => act(() => move(q.id, -1))} className={arrow}>↑</button>
                      <button type="button" aria-label={t("down", { label: q.labelEl })} disabled={pending || i === list.length - 1} onClick={() => act(() => move(q.id, 1))} className={arrow}>↓</button>
                    </span>
                    <span className="flex min-w-0 flex-[1_1_260px] flex-wrap items-center gap-1.5">
                      <span className="text-[15px]">{q.labelEl}</span>
                      {!q.isActive && <Badge tone="neutral">{t("badges.hidden")}</Badge>}
                      {q.sensitive && <Badge tone="amber">{t("badges.sensitive")}</Badge>}
                      {q.infection && <Badge tone="red">{t("badges.infection")}</Badge>}
                      <span className="text-[12.5px] text-muted">{t("pickCount", { count: q.choices.filter((c) => !c.hidden).length })}</span>
                    </span>
                    <button type="button" onClick={() => setEditing(q.id)} className="min-h-9 px-2 text-[13.5px] font-semibold text-primary hover:text-primary-hover">{t("edit")}</button>
                  </li>
                ),
              )}
            </ul>
            {editing === `new:${s}` ? (
              <Editor initial={blank(s)} sections={sections} pending={pending} cancel={() => setEditing(null)} save={(v) => act(() => add(v), () => setEditing(null))} />
            ) : (
              <button type="button" onClick={() => setEditing(`new:${s}`)} className="self-start text-[13.5px] font-semibold text-primary">+ {t("addQuestion")}</button>
            )}
          </section>
        );
      })}
    </div>
  );
}
