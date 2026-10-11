"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { PlusIcon } from "@/components/icons";
import { card, ErrorBox, inputClass, primaryButton, secondaryButton, textareaClass } from "@/components/ui";
import { ALLERGY_CHOICES, MEDICATION_CHOICES, SURGERY_CHOICES } from "@/lib/history/choices";
import { allUnansweredNo, answeredCount, bmi, PER_DAY, PRODUCTS, SMOKING, type Answer, type HistoryData, type YesNo } from "@/lib/history/data";

export type QuestionView = {
  key: string;
  section: string;
  label: string;
  detail: string | null;
  hint: string | null;
  // Quick picks shown on Ναι.
  choices: { key: string; label: string }[];
};

// Ναι / Όχι as two big buttons (DESIGN.md 4b), selected state clearly marked.
function YesNoButtons({ value, onChange, label }: { value?: YesNo; onChange: (v: YesNo) => void; label: string }) {
  const t = useTranslations("history");
  const cls = (on: boolean, yes: boolean) =>
    `h-10 min-w-16 rounded-[9px] px-4 text-sm ${on ? (yes ? "border-2 border-primary bg-primary-tint font-semibold text-primary" : "border-2 border-ink-3 bg-line-softer font-semibold text-ink") : "border border-line-strong bg-surface text-ink-2 hover:border-primary"}`;
  return (
    <div role="group" aria-label={label} className="flex shrink-0 gap-2">
      <button type="button" aria-pressed={value === "yes"} onClick={() => onChange("yes")} className={cls(value === "yes", true)}>{t("yes")}</button>
      <button type="button" aria-pressed={value === "no"} onClick={() => onChange("no")} className={cls(value === "no", false)}>{t("no")}</button>
    </div>
  );
}

function QuestionRow({
  label,
  detail,
  hint,
  value,
  onChange,
}: {
  label: string;
  detail: string | null;
  hint: string | null;
  value?: Answer;
  onChange: (a: Answer) => void;
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-line-softer py-3 first:border-t-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="min-w-0 flex-[1_1_260px] text-[15px]">{label}</span>
        <YesNoButtons value={value?.a} label={label} onChange={(a) => onChange(a === "yes" ? { a, d: value?.d } : { a })} />
      </div>
      {value?.a === "yes" && (
        <label className="block text-sm text-ink-3">
          {detail ?? ""}
          <input
            value={value.d ?? ""}
            onChange={(e) => onChange({ a: "yes", d: e.target.value })}
            placeholder={hint ?? ""}
            className={inputClass}
          />
        </label>
      )}
    </div>
  );
}

const pickChip = (on: boolean) =>
  `min-h-10 rounded-full px-3.5 py-1.5 text-sm ${on ? "border border-primary bg-primary-tint font-semibold text-primary" : "border border-line-strong bg-surface text-ink-2 hover:border-primary"}`;

// Yes / No, and on Yes: common choices to tick plus a notes box (medication, allergies).
function PickRow({
  label,
  choices,
  choiceLabel,
  notesLabel,
  notesHint,
  value,
  onChange,
}: {
  label: string;
  choices: readonly string[];
  choiceLabel: (key: string) => string;
  notesLabel: string;
  notesHint: string;
  value?: Answer;
  // Gets the latest answer, so quick clicks in a row never undo each other.
  onChange: (update: (prev: Answer | undefined) => Answer) => void;
}) {
  const items = value?.items ?? [];
  const toggle = (k: string) =>
    onChange((prev) => {
      const now = prev?.items ?? [];
      return { a: "yes", d: prev?.d, items: now.includes(k) ? now.filter((i) => i !== k) : [...now, k] };
    });
  return (
    <div className="flex flex-col gap-3 border-t border-line-softer py-3 first:border-t-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="min-w-0 flex-[1_1_260px] text-[15px]">{label}</span>
        <YesNoButtons value={value?.a} label={label} onChange={(a) => onChange((prev) => (a === "yes" ? { a, d: prev?.d, items: prev?.items } : { a }))} />
      </div>
      {value?.a === "yes" && (
        <>
          <div role="group" aria-label={label} className="flex flex-wrap gap-2">
            {choices.map((k) => (
              <button key={k} type="button" aria-pressed={items.includes(k)} onClick={() => toggle(k)} className={pickChip(items.includes(k))}>
                {choiceLabel(k)}
              </button>
            ))}
          </div>
          <label className="block text-sm text-ink-3">
            {notesLabel}
            <input value={value.d ?? ""} onChange={(e) => { const d = e.target.value; onChange((prev) => ({ a: "yes", d, items: prev?.items })); }} placeholder={notesHint} className={inputClass} />
          </label>
        </>
      )}
    </div>
  );
}

export function HistoryForm({
  patientId,
  questions,
  initial,
  action,
}: {
  patientId: string;
  questions: QuestionView[];
  initial: HistoryData;
  action: (json: string) => Promise<{ error?: string }>;
}) {
  const t = useTranslations("history");
  const [data, setData] = useState<HistoryData>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (patch: Partial<HistoryData>) => setData((d) => ({ ...d, ...patch }));
  const setAnswer = (key: string, a: Answer) => setData((d) => ({ ...d, answers: { ...d.answers, [key]: a } }));
  const { answered, total } = answeredCount(data, questions.map((q) => q.key));
  const sections = [...new Set(questions.map((q) => q.section))];
  const b = bmi(data.weightKg, data.heightCm);
  const num = (v: string) => (v.trim() === "" ? undefined : Number(v.replace(",", ".")));
  const chip = (on: boolean) =>
    `h-10 rounded-full px-3.5 text-sm ${on ? "border border-primary bg-primary font-semibold text-white" : "border border-line-strong bg-surface text-ink-2 hover:border-primary"}`;

  const keysOf = (section?: string) => questions.filter((q) => !section || q.section === section).map((q) => q.key);
  // "Όλα Όχι": unanswered → No (for one section, or the whole form incl. medication etc.).
  const allNo = (section?: string) =>
    setData((d) => (section ? { ...d, answers: allUnansweredNo({ answers: d.answers }, keysOf(section)).answers } : allUnansweredNo(d, keysOf())));
  const surgeryItems = data.surgeries?.items ?? [];
  const toggleSurgery = (name: string) =>
    setData((d) => {
      const items = d.surgeries?.items ?? [];
      return {
        ...d,
        surgeries: {
          a: "yes",
          notes: d.surgeries?.notes,
          items: items.some((i) => i.procedure === name) ? items.filter((i) => i.procedure !== name) : [...items, { procedure: name }],
        },
      };
    });

  const save = () =>
    start(async () => {
      const r = await action(JSON.stringify(data));
      if (r?.error) setError(t(`errors.${r.error}` as "errors.invalid"));
    });

  return (
    <div className="flex flex-col gap-4">
      <Link href={`/patients/${patientId}?tab=history`} className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold text-primary hover:text-primary-hover">
        <span aria-hidden="true">←</span>
        {t("title")}
      </Link>
      <div className="sticky top-[83px] z-20 flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-line bg-surface-2/95 px-4 py-3 backdrop-blur">
        <span className="text-sm font-semibold text-ink-2">{t("progress", { answered, total })}</span>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => allNo()} className={secondaryButton} title={t("allNoHelp")}>{t("allNo")}</button>
          <Link href={`/patients/${patientId}?tab=history`} className={secondaryButton}>{t("cancel")}</Link>
          <button type="button" onClick={save} disabled={pending} className={primaryButton}>{pending ? t("saving") : t("save")}</button>
        </div>
      </div>
      {error && <ErrorBox>{error}</ErrorBox>}

      <section className={`${card} flex flex-col gap-1 p-5`}>
        <h2 className="mb-1 text-[17px] font-semibold">{t("basics")}</h2>
        <PickRow
          label={t("medication")}
          choices={MEDICATION_CHOICES}
          choiceLabel={(k) => t(`medItems.${k}` as "medItems.thyroxine")}
          notesLabel={t("medicationDetail")}
          notesHint={t("medicationHint")}
          value={data.medication}
          onChange={(update) => setData((d) => ({ ...d, medication: update(d.medication) }))}
        />
        <PickRow
          label={t("allergies")}
          choices={ALLERGY_CHOICES}
          choiceLabel={(k) => t(`allergyItems.${k}` as "allergyItems.penicillin")}
          notesLabel={t("allergiesDetail")}
          notesHint={t("allergiesHint")}
          value={data.allergies}
          onChange={(update) => setData((d) => ({ ...d, allergies: update(d.allergies) }))}
        />

        <div className="flex flex-col gap-3 border-t border-line-softer py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-[15px]">{t("smoking")}</span>
            <div role="group" aria-label={t("smoking")} className="flex gap-2">
              {SMOKING.map((s) => (
                <button key={s} type="button" aria-pressed={data.smoking?.a === s} onClick={() => set({ smoking: { a: s } })} className={chip(data.smoking?.a === s)}>
                  {t(`smokingStatus.${s}`)}
                </button>
              ))}
            </div>
          </div>
          {data.smoking?.a === "yes" && (
            <div className="flex flex-col gap-2 pl-0 sm:pl-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="w-28 text-ink-3">{t("perDay")}</span>
                {PER_DAY.map((p) => (
                  <button key={p} type="button" aria-pressed={data.smoking?.perDay === p} onClick={() => set({ smoking: { ...data.smoking!, perDay: p } })} className={chip(data.smoking?.perDay === p)}>
                    {t(`perDayOptions.${p}`)}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="w-28 text-ink-3">{t("product")}</span>
                {PRODUCTS.map((p) => (
                  <button key={p} type="button" aria-pressed={data.smoking?.product === p} onClick={() => set({ smoking: { ...data.smoking!, product: p } })} className={chip(data.smoking?.product === p)}>
                    {t(`products.${p}`)}
                  </button>
                ))}
              </div>
            </div>
          )}
          {data.smoking?.a === "former" && (
            <label className="block text-sm text-ink-3 sm:pl-4">
              {t("quit")}
              <input value={data.smoking.quit ?? ""} onChange={(e) => set({ smoking: { a: "former", quit: e.target.value } })} placeholder={t("quitHint")} className={inputClass} />
            </label>
          )}
        </div>

        <div className="grid gap-3 border-t border-line-softer pt-3 sm:grid-cols-4">
          <label className="block text-sm text-ink-3">{t("weight")}
            <input inputMode="decimal" value={data.weightKg ?? ""} onChange={(e) => set({ weightKg: num(e.target.value) })} className={inputClass} />
          </label>
          <label className="block text-sm text-ink-3">{t("maxWeight")}
            <input inputMode="decimal" value={data.maxWeightKg ?? ""} onChange={(e) => set({ maxWeightKg: num(e.target.value) })} className={inputClass} />
          </label>
          <label className="block text-sm text-ink-3">{t("height")}
            <input inputMode="decimal" value={data.heightCm ?? ""} onChange={(e) => set({ heightCm: num(e.target.value) })} className={inputClass} />
          </label>
          <div className="flex flex-col justify-end text-sm text-ink-3">
            BMI
            <span className="flex h-11 items-center text-[17px] font-semibold text-ink">{b ?? "—"}</span>
          </div>
        </div>
      </section>

      {sections.map((s) => (
        <section key={s} className={`${card} p-5`}>
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[17px] font-semibold">{t(`sections.${s}` as "sections.heart")}</h2>
            <button type="button" onClick={() => allNo(s)} className="h-9 rounded-[9px] border border-line-strong px-3 text-[13px] text-ink-3 hover:border-primary hover:text-primary">
              {t("allNoSection")}
            </button>
          </div>
          {questions.filter((q) => q.section === s).map((q) =>
            q.choices.length ? (
              <PickRow
                key={q.key}
                label={q.label}
                choices={q.choices.map((c) => c.key)}
                choiceLabel={(k) => q.choices.find((c) => c.key === k)?.label ?? k}
                notesLabel={q.detail ?? t("notesShort")}
                notesHint={q.hint ?? ""}
                value={data.answers[q.key]}
                onChange={(update) => setData((d) => ({ ...d, answers: { ...d.answers, [q.key]: update(d.answers[q.key]) } }))}
              />
            ) : (
              <QuestionRow key={q.key} label={q.label} detail={q.detail} hint={q.hint} value={data.answers[q.key]} onChange={(a) => setAnswer(q.key, a)} />
            ),
          )}
        </section>
      ))}

      <section className={`${card} flex flex-col gap-3 p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[17px] font-semibold">{t("surgeries")}</h2>
          <YesNoButtons
            value={data.surgeries?.a}
            label={t("surgeries")}
            onChange={(a) => set({ surgeries: { a, items: a === "yes" ? surgeryItems : [], notes: a === "yes" ? data.surgeries?.notes : undefined } })}
          />
        </div>
        {data.surgeries?.a === "yes" && (
          <>
            <div role="group" aria-label={t("surgeries")} className="flex flex-wrap gap-2">
              {SURGERY_CHOICES.map((k) => {
                const name = t(`surgeryItems.${k}` as "surgeryItems.caesarean");
                const on = surgeryItems.some((i) => i.procedure === name);
                return (
                  <button key={k} type="button" aria-pressed={on} onClick={() => toggleSurgery(name)} className={pickChip(on)}>
                    {name}
                  </button>
                );
              })}
            </div>
            {surgeryItems.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="text-xs text-muted">
                    <tr><th className="py-1.5 pr-2 font-semibold">{t("procedure")}</th><th className="w-28 py-1.5 pr-2 font-semibold">{t("year")}</th><th className="py-1.5 pr-2 font-semibold">{t("complications")}</th><th className="w-8" /></tr>
                  </thead>
                  <tbody>
                    {surgeryItems.map((it, i) => {
                      const upd = (patch: Partial<typeof it>) =>
                        set({ surgeries: { a: "yes", notes: data.surgeries?.notes, items: surgeryItems.map((x, j) => (j === i ? { ...x, ...patch } : x)) } });
                      return (
                        <tr key={i}>
                          <td className="py-1 pr-2"><input aria-label={t("procedure")} value={it.procedure} onChange={(e) => upd({ procedure: e.target.value })} className={`${inputClass} mt-0`} /></td>
                          <td className="py-1 pr-2"><input aria-label={t("year")} inputMode="numeric" value={it.year ?? ""} onChange={(e) => upd({ year: e.target.value })} className={`${inputClass} mt-0`} /></td>
                          <td className="py-1 pr-2"><input aria-label={t("complications")} value={it.complications ?? ""} onChange={(e) => upd({ complications: e.target.value })} className={`${inputClass} mt-0`} /></td>
                          <td>
                            <button type="button" aria-label={t("remove")} onClick={() => set({ surgeries: { a: "yes", notes: data.surgeries?.notes, items: surgeryItems.filter((_, j) => j !== i) } })} className="text-muted hover:text-danger">✕</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <button type="button" onClick={() => set({ surgeries: { a: "yes", notes: data.surgeries?.notes, items: [...surgeryItems, { procedure: "" }] } })} className="inline-flex items-center gap-1 self-start text-sm font-semibold text-primary">
              <PlusIcon size={15} />{t("addSurgery")}
            </button>
            <label className="block text-sm text-ink-3">
              {t("surgeryNotes")}
              <input value={data.surgeries.notes ?? ""} onChange={(e) => set({ surgeries: { a: "yes", items: surgeryItems, notes: e.target.value } })} className={inputClass} />
            </label>
          </>
        )}
      </section>

      <section className={`${card} p-5`}>
        <label className="block text-[17px] font-semibold">{t("notes")}
          <textarea rows={4} value={data.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} className={`${textareaClass} font-normal`} />
        </label>
      </section>

      <div className="flex gap-2">
        <button type="button" onClick={save} disabled={pending} className={primaryButton}>{pending ? t("saving") : t("save")}</button>
        <Link href={`/patients/${patientId}?tab=history`} className={secondaryButton}>{t("cancel")}</Link>
      </div>
    </div>
  );
}
