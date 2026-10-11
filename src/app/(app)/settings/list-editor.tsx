"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Badge, ErrorBox, fieldClass, primaryButton } from "@/components/ui";
import type { SettingsState } from "./actions";

type Item = { id: string; label: string; isActive: boolean };

// One editable list: rename in place, ↑ ↓ to reorder, hide/show, add at the bottom.
export function ListEditor({
  items,
  add,
  rename,
  move,
  setActive,
}: {
  items: Item[];
  add: (label: string) => Promise<SettingsState>;
  rename: (id: string, label: string) => Promise<SettingsState>;
  move: (id: string, step: -1 | 1) => Promise<SettingsState>;
  setActive: (id: string, active: boolean) => Promise<SettingsState>;
}) {
  const t = useTranslations("settingsLists");
  const [state, setState] = useState<SettingsState>({});
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState("");
  const act = (fn: () => Promise<SettingsState>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      setState(r);
      if (!r.error) after?.();
    });
  const arrow = "flex h-9 w-9 items-center justify-center rounded-[8px] border border-line-strong text-ink-3 hover:border-primary hover:text-primary disabled:opacity-30";

  return (
    <div className="flex flex-col gap-3">
      {state.error && <ErrorBox>{t(`errors.${state.error}`)}</ErrorBox>}
      <ul className="flex flex-col divide-y divide-line-softer">
        {items.map((it, i) => (
          <li key={it.id} className={`flex flex-wrap items-center gap-2 py-2 ${it.isActive ? "" : "opacity-55"}`}>
            <span className="flex gap-1">
              <button type="button" aria-label={t("up", { label: it.label })} disabled={pending || i === 0} onClick={() => act(() => move(it.id, -1))} className={arrow}>↑</button>
              <button type="button" aria-label={t("down", { label: it.label })} disabled={pending || i === items.length - 1} onClick={() => act(() => move(it.id, 1))} className={arrow}>↓</button>
            </span>
            <input
              key={it.label}
              defaultValue={it.label}
              aria-label={t("name")}
              onBlur={(e) => e.target.value.trim() !== it.label && act(() => rename(it.id, e.target.value), undefined)}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              className={`${fieldClass} min-w-0 flex-[1_1_220px]`}
            />
            {!it.isActive && <Badge tone="neutral">{t("hidden")}</Badge>}
            <button type="button" disabled={pending} onClick={() => act(() => setActive(it.id, !it.isActive))} className="min-h-9 px-2 text-[13.5px] font-semibold text-primary hover:text-primary-hover">
              {it.isActive ? t("hide") : t("show")}
            </button>
          </li>
        ))}
      </ul>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim()) act(() => add(draft), () => setDraft(""));
        }}
        className="flex flex-wrap gap-2"
      >
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t("newPlaceholder")} aria-label={t("newPlaceholder")} className={`${fieldClass} min-w-0 flex-[1_1_220px]`} />
        <button type="submit" disabled={pending || !draft.trim()} className={primaryButton}>{t("add")}</button>
      </form>
      <p className="text-[13px] text-muted">{t("note")}</p>
    </div>
  );
}
