"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Dropdown } from "@/components/dropdown";
import { Badge, ErrorBox, fieldClass, inputClass, primaryButton, secondaryButton } from "@/components/ui";
import { calColor } from "@/lib/calendar/colors";
import type { HoursRange } from "@/lib/calendar/hours";
import type { CalendarSettingsState } from "../actions";

type TypeRow = { id: string; labelEl: string; labelEn: string; color: string; defaultMinutes: number; layer: string; isActive: boolean; forNewPatients: boolean };
type ResourceRow = { id: string; label: string; kind: string; userId: string | null; hours: HoursRange[]; isActive: boolean };
type BlockRow = { id: string; resourceId: string | null; kind: string; label: string | null; from: string; to: string };

const COLORS = ["teal", "tealLight", "consult", "recheck", "amber", "purple", "blue", "rose", "grey", "online"];
const LAYERS = ["OFFICE", "ONLINE", "SURGERY", "SPA"];
const KINDS = ["DOCTOR", "NURSE", "ROOM", "OPERATING_ROOM", "CABIN"];
const BLOCKS = ["BREAK", "CONGRESS", "LEAVE", "OTHER"];
const DAYS = [1, 2, 3, 4, 5, 6, 7];
const arrow = "flex h-9 w-9 items-center justify-center rounded-[8px] border border-line-strong text-ink-3 hover:border-primary hover:text-primary disabled:opacity-30";

function useAct() {
  const t = useTranslations("settingsCalendar");
  const [state, setState] = useState<CalendarSettingsState>({});
  const [pending, start] = useTransition();
  const act = (fn: () => Promise<CalendarSettingsState>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      setState(r);
      if (!r.error) after?.();
    });
  const error = state.error ? <ErrorBox>{t(`errors.${state.error}`)}</ErrorBox> : null;
  return { act, pending, error };
}

// ── Appointment types ──────────────────────────────────────────────────────────────
function TypeEditor({ initial, save, cancel, pending }: { initial: Omit<TypeRow, "id">; save: (v: Omit<TypeRow, "id">) => void; cancel: () => void; pending: boolean }) {
  const t = useTranslations("settingsCalendar");
  const [v, setV] = useState(initial);
  const set = (p: Partial<typeof v>) => setV((x) => ({ ...x, ...p }));
  return (
    <form onSubmit={(e) => { e.preventDefault(); save(v); }} className="flex flex-col gap-3 rounded-[12px] border border-primary/40 bg-surface-2 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm text-ink-3">{t("labelEl")}<input value={v.labelEl} onChange={(e) => set({ labelEl: e.target.value })} className={inputClass} /></label>
        <label className="block text-sm text-ink-3">{t("labelEn")}<input value={v.labelEn} onChange={(e) => set({ labelEn: e.target.value })} className={inputClass} /></label>
        <label className="block text-sm text-ink-3">{t("minutes")}<input value={String(v.defaultMinutes)} onChange={(e) => set({ defaultMinutes: Number(e.target.value.replace(/\D/g, "")) || 0 })} inputMode="numeric" className={inputClass} /></label>
        <label className="block text-sm text-ink-3">{t("layer")}
          <Dropdown value={v.layer} onChange={(x) => x && set({ layer: x })} label={t("layer")} placeholder={null} options={LAYERS.map((l) => ({ value: l, label: t(`layers.${l}`) }))} className="mt-1" />
        </label>
      </div>
      <div className="flex flex-col gap-1.5 text-sm text-ink-3">{t("color")}
        <div role="radiogroup" aria-label={t("color")} className="flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={v.color === c} aria-label={t(`colors.${c}`)} onClick={() => set({ color: c })}
              className={`flex h-10 items-center gap-2 rounded-full border px-3 text-[13px] ${v.color === c ? "border-primary bg-primary-tint font-semibold text-primary" : "border-line-strong"}`}>
              <span className={`h-4 w-4 rounded-full ${calColor(c).dot}`} />{t(`colors.${c}`)}
            </button>
          ))}
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v.forNewPatients} onChange={(e) => set({ forNewPatients: e.target.checked })} className="h-4 w-4 accent-primary" />{t("forNewPatients")}</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v.isActive} onChange={(e) => set({ isActive: e.target.checked })} className="h-4 w-4 accent-primary" />{t("active")}</label>
      <div className="flex gap-2">
        <button type="submit" disabled={pending || !v.labelEl.trim()} className={primaryButton}>{t("save")}</button>
        <button type="button" onClick={cancel} className={secondaryButton}>{t("cancel")}</button>
      </div>
    </form>
  );
}

export function TypesSettings({ rows, save, move }: { rows: TypeRow[]; save: (id: string | null, v: Omit<TypeRow, "id">) => Promise<CalendarSettingsState>; move: (id: string, step: -1 | 1) => Promise<CalendarSettingsState> }) {
  const t = useTranslations("settingsCalendar");
  const { act, pending, error } = useAct();
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      {error}
      <ul className="flex flex-col divide-y divide-line-softer">
        {rows.map((r, i) =>
          editing === r.id ? (
            <li key={r.id} className="py-2"><TypeEditor initial={r} pending={pending} cancel={() => setEditing(null)} save={(v) => act(() => save(r.id, v), () => setEditing(null))} /></li>
          ) : (
            <li key={r.id} className={`flex flex-wrap items-center gap-2 py-2 ${r.isActive ? "" : "opacity-55"}`}>
              <span className="flex gap-1">
                <button type="button" aria-label={t("up", { label: r.labelEl })} disabled={pending || i === 0} onClick={() => act(() => move(r.id, -1))} className={arrow}>↑</button>
                <button type="button" aria-label={t("down", { label: r.labelEl })} disabled={pending || i === rows.length - 1} onClick={() => act(() => move(r.id, 1))} className={arrow}>↓</button>
              </span>
              <span className={`rounded-[8px] px-3 py-1.5 text-sm font-semibold ${calColor(r.color).box}`}>{r.labelEl}</span>
              <span className="text-[13px] text-muted">{r.defaultMinutes}′ · {t(`layers.${r.layer}`)}{r.forNewPatients && ` · ${t("forNewPatientsShort")}`}</span>
              {!r.isActive && <Badge tone="neutral">{t("hidden")}</Badge>}
              <button type="button" onClick={() => setEditing(r.id)} className="ml-auto min-h-9 px-2 text-[13.5px] font-semibold text-primary">{t("edit")}</button>
            </li>
          ),
        )}
      </ul>
      {editing === "new" ? (
        <TypeEditor initial={{ labelEl: "", labelEn: "", color: "teal", defaultMinutes: 30, layer: "OFFICE", isActive: true, forNewPatients: false }} pending={pending} cancel={() => setEditing(null)} save={(v) => act(() => save(null, v), () => setEditing(null))} />
      ) : (
        <button type="button" onClick={() => setEditing("new")} className="self-start text-[13.5px] font-semibold text-primary">+ {t("addType")}</button>
      )}
    </div>
  );
}

// ── Resources with weekly hours ────────────────────────────────────────────────────
function HoursEditor({ value, onChange }: { value: HoursRange[]; onChange: (v: HoursRange[]) => void }) {
  const t = useTranslations("settingsCalendar");
  const set = (i: number, p: Partial<HoursRange>) => onChange(value.map((h, j) => (j === i ? { ...h, ...p } : h)));
  return (
    <div className="flex flex-col gap-1.5">
      {DAYS.map((d) => (
        <div key={d} className="flex flex-wrap items-center gap-2 text-sm">
          <span className="w-12 font-medium">{t(`days.${d}`)}</span>
          {value.map((h, i) => h.day !== d ? null : (
            <span key={i} className="flex items-center gap-1">
              <input value={h.from} onChange={(e) => set(i, { from: e.target.value })} aria-label={t("from")} className={`${fieldClass} h-9 w-[74px] text-center`} />
              –
              <input value={h.to} onChange={(e) => set(i, { to: e.target.value })} aria-label={t("to")} className={`${fieldClass} h-9 w-[74px] text-center`} />
              <button type="button" aria-label={t("removeRange")} onClick={() => onChange(value.filter((_, j) => j !== i))} className="px-1 text-muted hover:text-danger">✕</button>
            </span>
          ))}
          {!value.some((h) => h.day === d) && <span className="text-muted">{t("closed")}</span>}
          <button type="button" onClick={() => onChange([...value, { day: d, from: "09:00", to: "14:00" }])} className="text-[13px] font-semibold text-primary">+ {t("addRange")}</button>
        </div>
      ))}
    </div>
  );
}

function ResourceEditor({ initial, users, save, cancel, pending }: { initial: Omit<ResourceRow, "id">; users: { id: string; name: string }[]; save: (v: Omit<ResourceRow, "id">) => void; cancel: () => void; pending: boolean }) {
  const t = useTranslations("settingsCalendar");
  const [v, setV] = useState(initial);
  const set = (p: Partial<typeof v>) => setV((x) => ({ ...x, ...p }));
  return (
    <form onSubmit={(e) => { e.preventDefault(); save(v); }} className="flex flex-col gap-3 rounded-[12px] border border-primary/40 bg-surface-2 p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-sm text-ink-3">{t("resourceLabel")}<input value={v.label} onChange={(e) => set({ label: e.target.value })} className={inputClass} /></label>
        <label className="block text-sm text-ink-3">{t("kind")}
          <Dropdown value={v.kind} onChange={(x) => x && set({ kind: x })} label={t("kind")} placeholder={null} options={KINDS.map((k) => ({ value: k, label: t(`kinds.${k}`) }))} className="mt-1" />
        </label>
        <label className="block text-sm text-ink-3">{t("user")}
          <Dropdown value={v.userId ?? undefined} onChange={(x) => set({ userId: x ?? null })} label={t("user")} options={users.map((u) => ({ value: u.id, label: u.name }))} className="mt-1" />
        </label>
      </div>
      <div className="flex flex-col gap-1.5"><span className="text-sm font-semibold">{t("hours")}</span><HoursEditor value={v.hours} onChange={(hours) => set({ hours })} /></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v.isActive} onChange={(e) => set({ isActive: e.target.checked })} className="h-4 w-4 accent-primary" />{t("active")}</label>
      <div className="flex gap-2">
        <button type="submit" disabled={pending || !v.label.trim()} className={primaryButton}>{t("save")}</button>
        <button type="button" onClick={cancel} className={secondaryButton}>{t("cancel")}</button>
      </div>
    </form>
  );
}

export function ResourcesSettings({ rows, users, save, move }: { rows: ResourceRow[]; users: { id: string; name: string }[]; save: (id: string | null, v: Omit<ResourceRow, "id">) => Promise<CalendarSettingsState>; move: (id: string, step: -1 | 1) => Promise<CalendarSettingsState> }) {
  const t = useTranslations("settingsCalendar");
  const { act, pending, error } = useAct();
  const [editing, setEditing] = useState<string | null>(null);
  const summary = (hours: HoursRange[]) =>
    DAYS.filter((d) => hours.some((h) => h.day === d)).map((d) => `${t(`days.${d}`)} ${hours.filter((h) => h.day === d).map((h) => `${h.from}–${h.to}`).join(", ")}`).join(" · ") || t("closed");
  return (
    <div className="flex flex-col gap-2">
      {error}
      <ul className="flex flex-col divide-y divide-line-softer">
        {rows.map((r, i) =>
          editing === r.id ? (
            <li key={r.id} className="py-2"><ResourceEditor initial={r} users={users} pending={pending} cancel={() => setEditing(null)} save={(v) => act(() => save(r.id, v), () => setEditing(null))} /></li>
          ) : (
            <li key={r.id} className={`flex flex-wrap items-center gap-2 py-2 ${r.isActive ? "" : "opacity-55"}`}>
              <span className="flex gap-1">
                <button type="button" aria-label={t("up", { label: r.label })} disabled={pending || i === 0} onClick={() => act(() => move(r.id, -1))} className={arrow}>↑</button>
                <button type="button" aria-label={t("down", { label: r.label })} disabled={pending || i === rows.length - 1} onClick={() => act(() => move(r.id, 1))} className={arrow}>↓</button>
              </span>
              <span className="flex min-w-0 flex-[1_1_300px] flex-col">
                <span className="text-[15px] font-semibold">{r.label} <span className="text-[13px] font-normal text-muted">· {t(`kinds.${r.kind}`)}{r.userId && ` · ${users.find((u) => u.id === r.userId)?.name ?? ""}`}</span></span>
                <span className="text-[12.5px] text-muted">{summary(r.hours)}</span>
              </span>
              {!r.isActive && <Badge tone="neutral">{t("hidden")}</Badge>}
              <button type="button" onClick={() => setEditing(r.id)} className="min-h-9 px-2 text-[13.5px] font-semibold text-primary">{t("edit")}</button>
            </li>
          ),
        )}
      </ul>
      {editing === "new" ? (
        <ResourceEditor initial={{ label: "", kind: "ROOM", userId: null, hours: [], isActive: true }} users={users} pending={pending} cancel={() => setEditing(null)} save={(v) => act(() => save(null, v), () => setEditing(null))} />
      ) : (
        <button type="button" onClick={() => setEditing("new")} className="self-start text-[13.5px] font-semibold text-primary">+ {t("addResource")}</button>
      )}
    </div>
  );
}

// ── Blocked time ───────────────────────────────────────────────────────────────────
export function BlocksSettings({ rows, resources, add, remove }: { rows: BlockRow[]; resources: { id: string; label: string }[]; add: (v: Record<string, unknown>) => Promise<CalendarSettingsState>; remove: (id: string) => Promise<CalendarSettingsState> }) {
  const t = useTranslations("settingsCalendar");
  const { act, pending, error } = useAct();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Athens" }).format(new Date()).split("-").reverse().join("/");
  const [v, setV] = useState({ resourceId: "", kind: "CONGRESS", label: "", fromDate: today, fromTime: "00:00", toDate: today, toTime: "23:59" });
  const set = (p: Partial<typeof v>) => setV((x) => ({ ...x, ...p }));
  return (
    <div className="flex flex-col gap-3">
      {error}
      <ul className="flex flex-col divide-y divide-line-softer">
        {rows.length === 0 && <li className="py-2 text-sm text-muted">{t("noBlocks")}</li>}
        {rows.map((b) => (
          <li key={b.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
            <span className="h-8 w-2 rounded-full bg-[repeating-linear-gradient(45deg,var(--color-cal-grey)_0_3px,transparent_3px_6px)]" aria-hidden="true" />
            <span className="flex min-w-0 flex-[1_1_300px] flex-col">
              <span className="font-semibold">{b.label || t(`blockKinds.${b.kind}`)} <span className="font-normal text-muted">· {b.resourceId ? resources.find((r) => r.id === b.resourceId)?.label : t("everyone")}</span></span>
              <span className="text-[12.5px] text-muted">{b.from} → {b.to}</span>
            </span>
            <button type="button" disabled={pending} onClick={() => confirm(t("confirmRemove")) && act(() => remove(b.id))} className="min-h-9 px-2 text-[13.5px] font-semibold text-danger">{t("remove")}</button>
          </li>
        ))}
      </ul>
      <form onSubmit={(e) => { e.preventDefault(); act(() => add(v), () => set({ label: "" })); }} className="flex flex-col gap-3 rounded-[12px] border border-line-soft bg-surface-2 p-4">
        <span className="text-sm font-semibold">{t("addBlock")}</span>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-sm text-ink-3">{t("who")}
            <Dropdown value={v.resourceId || undefined} onChange={(x) => set({ resourceId: x ?? "" })} label={t("who")} placeholder={t("everyone")} options={resources.map((r) => ({ value: r.id, label: r.label }))} className="mt-1" />
          </label>
          <label className="block text-sm text-ink-3">{t("blockKind")}
            <Dropdown value={v.kind} onChange={(x) => x && set({ kind: x })} label={t("blockKind")} placeholder={null} options={BLOCKS.map((k) => ({ value: k, label: t(`blockKinds.${k}`) }))} className="mt-1" />
          </label>
          <label className="block text-sm text-ink-3">{t("blockLabel")}<input value={v.label} onChange={(e) => set({ label: e.target.value })} className={inputClass} /></label>
          <label className="block text-sm text-ink-3">{t("from")}
            <span className="mt-1 flex gap-2"><input value={v.fromDate} onChange={(e) => set({ fromDate: e.target.value })} placeholder="ΗΗ/ΜΜ/ΕΕΕΕ" inputMode="numeric" className={`${fieldClass} min-w-0 flex-1`} /><input value={v.fromTime} onChange={(e) => set({ fromTime: e.target.value })} aria-label={t("fromTime")} className={`${fieldClass} w-[80px] text-center`} /></span>
          </label>
          <label className="block text-sm text-ink-3">{t("to")}
            <span className="mt-1 flex gap-2"><input value={v.toDate} onChange={(e) => set({ toDate: e.target.value })} placeholder="ΗΗ/ΜΜ/ΕΕΕΕ" inputMode="numeric" className={`${fieldClass} min-w-0 flex-1`} /><input value={v.toTime} onChange={(e) => set({ toTime: e.target.value })} aria-label={t("toTime")} className={`${fieldClass} w-[80px] text-center`} /></span>
          </label>
        </div>
        <button type="submit" disabled={pending} className={`${primaryButton} self-start`}>{t("addBlock")}</button>
      </form>
    </div>
  );
}

// ── Hours rules (calendar v2) ──────────────────────────────────────────────────────
export function HoursRulesSettings({ initial, columns, save }: {
  initial: { surgery: HoursRange[]; flexBefore: number; flexAfter: number };
  columns: { id: string; label: string; hours: HoursRange[] }[];
  save: (v: Record<string, unknown>) => Promise<CalendarSettingsState>;
}) {
  const t = useTranslations("settingsCalendar");
  const { act, pending, error } = useAct();
  const [v, setV] = useState({ surgery: initial.surgery, flexBefore: String(initial.flexBefore), flexAfter: String(initial.flexAfter) });
  const [saved, setSaved] = useState(false);
  const summary = (hours: HoursRange[]) =>
    DAYS.filter((d) => hours.some((h) => h.day === d)).map((d) => `${t(`days.${d}`)} ${hours.filter((h) => h.day === d).map((h) => `${h.from}–${h.to}`).join(", ")}`).join(" · ") || t("closed");
  return (
    <form onSubmit={(e) => { e.preventDefault(); setSaved(false); act(() => save({ surgery: v.surgery, flexBefore: v.flexBefore, flexAfter: v.flexAfter }), () => setSaved(true)); }} className="flex flex-col gap-5">
      {error}
      <div className="flex flex-col gap-1.5">
        <span className="text-[15px] font-semibold">{t("rules.office")}</span>
        <span className="text-[13px] text-muted">{t("rules.officeHelp")}</span>
        <ul className="flex flex-col gap-1 text-sm">
          {columns.map((c) => <li key={c.id}><b>{c.label}</b> <span className="text-ink-3">· {summary(c.hours)}</span></li>)}
        </ul>
        <Link href="/settings/calendar?tab=resources" className="self-start text-[13.5px] font-semibold text-primary">{t("rules.changeOffice")} →</Link>
      </div>
      <div className="flex flex-col gap-1.5 border-t border-line-softer pt-4">
        <span className="text-[15px] font-semibold">{t("rules.flex")}</span>
        <span className="text-[13px] text-muted">{t("rules.flexHelp")}</span>
        <div className="flex flex-wrap gap-3">
          <label className="block w-[150px] text-sm text-ink-3">{t("rules.flexBefore")}<input value={v.flexBefore} onChange={(e) => setV({ ...v, flexBefore: e.target.value.replace(/\D/g, "") })} inputMode="numeric" className={inputClass} /></label>
          <label className="block w-[150px] text-sm text-ink-3">{t("rules.flexAfter")}<input value={v.flexAfter} onChange={(e) => setV({ ...v, flexAfter: e.target.value.replace(/\D/g, "") })} inputMode="numeric" className={inputClass} /></label>
        </div>
      </div>
      <div className="flex flex-col gap-1.5 border-t border-line-softer pt-4">
        <span className="text-[15px] font-semibold">{t("rules.surgery")}</span>
        <span className="text-[13px] text-muted">{t("rules.surgeryHelp")}</span>
        <HoursEditor value={v.surgery} onChange={(surgery) => setV({ ...v, surgery })} />
      </div>
      <p className="rounded-[10px] bg-surface-2 px-3 py-2 text-[13px] text-ink-3">{t("rules.weekend")}</p>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={`${primaryButton} self-start`}>{t("save")}</button>
        {saved && !pending && <span role="status" className="text-sm font-semibold text-ok-ink">✓ {t("saved")}</span>}
      </div>
    </form>
  );
}
