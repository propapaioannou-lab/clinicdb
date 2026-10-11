"use client";

import { useState, useTransition } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Avatar, Badge, card, dangerButton, ErrorBox, inputClass, Notice, primaryButton, secondaryButton } from "@/components/ui";
import { patientCode } from "@/lib/patients/format";
import type { PatientFormOptions } from "@/lib/patients/options";
import type { PatientView } from "@/lib/patients/record";
import type { PatientFormState } from "../actions";
import { PatientForm, type PatientFormValues } from "../patient-form";

type Mode = "summary" | "details" | "edit" | "flag";

// 2b · the patient card (DESIGN.md). Click to expand in place: every detail, then
// Επεξεργασία / Σήμανση / Αρχειοθέτηση without leaving the page.
export function PatientCard({
  p,
  age,
  editable,
  archivable,
  options,
  formValues,
  updateAction,
  flagAction,
  archiveAction,
  widgets,
  alerts = [],
}: {
  widgets: React.ReactNode;
  // Chips from the medical history (allergy, smoking).
  alerts?: { text: string; tone: "danger" | "neutral" }[];
  p: PatientView;
  age: { years: number; months: number } | null;
  editable: boolean;
  archivable: boolean;
  options: PatientFormOptions | null;
  formValues: PatientFormValues | null;
  updateAction: (fd: FormData) => Promise<PatientFormState>;
  flagAction: (fd: FormData) => Promise<PatientFormState>;
  archiveAction: (archived: boolean) => Promise<void>;
}) {
  const t = useTranslations("patient");
  const tf = useTranslations("patientForm");
  const format = useFormatter();
  const [mode, setMode] = useState<Mode>("summary");
  const [flagError, setFlagError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState(false);
  const show = (m: Mode) => {
    setSavedNote(false);
    setMode(m);
  };
  const saved = () => {
    setMode("details");
    setSavedNote(true);
  };
  const [pending, start] = useTransition();
  const name = `${p.surname} ${p.firstName}`.trim();
  const c = p.contacts;
  const mainPhone = c?.phones.find((ph) => ph.isMain) ?? c?.phones[0];
  const date = (d: Date | null, utc = false) =>
    d ? format.dateTime(new Date(d), { day: "2-digit", month: "2-digit", year: "numeric", ...(utc && { timeZone: "UTC" }) }) : "";

  const flagTone = p.flag === "RED" ? "red" : "amber";
  const flagText = [t(`flag.${p.flag}`), ...p.flagReasons.map((r) => r.label)].join(" · ");

  return (
    <>
      <div className="flex flex-wrap items-stretch gap-4">
        <section aria-label={t("cardLabel")} className={`${card} flex min-w-0 flex-[999_1_520px] flex-col gap-4 px-6 py-[22px]`}>
          <div className="flex flex-wrap items-center gap-5">
            <Avatar name={name} size={64} />
            <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-[26px] font-semibold tracking-[-0.01em]">{name}</h1>
                {p.flag !== "NONE" && (
                  <Badge tone={flagTone}>
                    <span className={`h-2 w-2 rounded-full ${p.flag === "RED" ? "bg-danger" : "bg-warn"}`} />
                    {flagText}
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap gap-x-[18px] gap-y-1.5 text-sm text-ink-3">
                <span>{patientCode(p.number, p.company.code)}</span>
                {(age || p.sex) && (
                  <span>{[age && t("ageShort", { years: age.years }), p.sex && tf(`sexes.${p.sex}`)].filter(Boolean).join(" · ")}</span>
                )}
                {c?.amka && <span>{t("amka", { amka: c.amka })}</span>}
                {mainPhone && <a href={`tel:${mainPhone.number.replace(/\s/g, "")}`} className="text-primary hover:text-primary-hover">{mainPhone.number}</a>}
                {c?.emails[0] && <a href={`mailto:${c.emails[0]}`} className="text-primary hover:text-primary-hover">{c.emails[0]}</a>}
                <span>{t("language", { language: tf(`languages.${p.language}`) })}</span>
              </div>
              {(p.infectiousDiseases || alerts.length > 0) && (
                <div className="mt-1 flex flex-wrap gap-2">
                  {p.infectiousDiseases && (
                    <span className="rounded-lg bg-danger-bg px-2.5 py-1 text-[13px] font-semibold text-danger-ink">{t("infectious", { text: p.infectiousDiseases })}</span>
                  )}
                  {alerts.map((a) => (
                    <span key={a.text} className={`rounded-lg px-2.5 py-1 text-[13px] ${a.tone === "danger" ? "bg-danger-bg font-semibold text-danger-ink" : "bg-line-softer text-ink-3"}`}>{a.text}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            aria-expanded={mode !== "summary"}
            onClick={() => show(mode === "summary" ? "details" : "summary")}
            className="self-start text-[13.5px] font-semibold text-primary hover:text-primary-hover"
          >
            {mode === "summary" ? `${t("showAll")} ▾` : `${t("showLess")} ▴`}
          </button>
        </section>
        {/* On a phone the details open right under the card; the widgets follow them. */}
        <div className={mode === "summary" ? "contents" : "hidden md:contents"}>{widgets}</div>
      </div>

      {mode !== "summary" && (
        <section aria-label={t("cardLabel")} className={`${card} px-6 py-5`}>
          {mode === "details" && (
            <div className="flex flex-col gap-4">
              {savedNote && <Notice>{tf("saved")}</Notice>}
              <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <Detail label={tf("fatherName")} value={p.fatherName} />
                {c && <Detail label={tf("birthDate")} value={date(c.birthDate, true)} />}
                {age && <Detail label={t("ageLabel")} value={t("age", { years: age.years, months: age.months })} />}
                <Detail label={tf("maritalStatus")} value={p.maritalStatus} />
                <Detail label={tf("occupation")} value={p.occupation} />
                <Detail label={tf("treatingDoctor")} value={p.treatingDoctor} />
                {c && (
                  <>
                    <Detail label={tf("phones")} value={c.phones.map((ph) => `${ph.number} (${tf(`phoneTypes.${ph.type}`)}${ph.isMain ? `, ${tf("main")}` : ""})`).join(" · ")} />
                    <Detail label={tf("emails")} value={c.emails.join(" · ")} />
                    <Detail label={tf("addressGroup")} value={[c.address, c.area, c.postcode, c.city, c.country].filter(Boolean).join(", ")} />
                    <Detail label={tf("afm")} value={[c.afm, c.taxOffice].filter(Boolean).join(" · ")} />
                    <Detail label={t("eprescription")} value={[c.eprescriptionCity, c.eprescriptionPhone].filter(Boolean).join(" · ")} />
                    <Detail label={tf("referralSource")} value={[c.referralSource, c.referralNote].filter(Boolean).join(" · ")} />
                  </>
                )}
                <Detail label={t("registered")} value={date(p.registeredAt)} />
                {p.flag !== "NONE" && <Detail label={t("flagLabel")} value={[flagText, p.flagNote, p.flagSetAt && date(p.flagSetAt)].filter(Boolean).join(" · ")} wide />}
              </dl>
              <div className="flex flex-wrap gap-2">
                {editable && <button type="button" onClick={() => show("edit")} className={primaryButton}>{t("edit")}</button>}
                {editable && <button type="button" onClick={() => show("flag")} className={secondaryButton}>{t("flagButton")}</button>}
                {archivable && !p.archivedAt && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => window.confirm(t("archiveConfirm")) && start(() => archiveAction(true))}
                    className={dangerButton}
                  >
                    {t("archive")}
                  </button>
                )}
              </div>
            </div>
          )}

          {mode === "edit" && options && formValues && (
            <div>
              <PatientForm mode="edit" initial={formValues} options={options} action={updateAction} onCancel={() => show("details")} onSaved={saved} />
            </div>
          )}

          {mode === "flag" && options && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                start(async () => {
                  const r = await flagAction(fd);
                  if (r.error) setFlagError(tf(`errors.${r.error}`));
                  else saved();
                });
              }}
              className="flex flex-col gap-3"
            >
              <p className="text-sm text-ink-3">{t("flagHelp")}</p>
              <div role="radiogroup" className="flex flex-wrap gap-2">
                {(["NONE", "YELLOW", "RED"] as const).map((f) => (
                  <label key={f} className="inline-flex h-10 items-center gap-2 rounded-full border border-line-strong bg-surface px-3.5 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary-tint">
                    <input type="radio" name="flag" value={f} defaultChecked={p.flag === f} className="accent-primary" />
                    {f !== "NONE" && <span className={`h-2.5 w-2.5 rounded-full ${f === "RED" ? "bg-danger" : "bg-warn"}`} />}
                    {t(`flag.${f}`)}
                  </label>
                ))}
              </div>
              <fieldset className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                <legend className="mb-1 text-sm font-medium text-ink-2">{t("flagReasons")}</legend>
                {options.flagReasons.map((r) => (
                  <label key={r.id} className="flex items-center gap-2">
                    <input type="checkbox" name="reason" value={r.id} defaultChecked={p.flagReasons.some((x) => x.id === r.id)} className="accent-primary" />
                    {r.label}
                  </label>
                ))}
              </fieldset>
              <label className="block text-sm font-medium text-ink-2">
                {t("flagNote")}
                <input name="flagNote" defaultValue={p.flagNote ?? ""} className={inputClass} />
              </label>
              {flagError && <ErrorBox>{flagError}</ErrorBox>}
              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={pending} className={primaryButton}>{tf("save")}</button>
                <button type="button" onClick={() => show("details")} className={secondaryButton}>{tf("cancel")}</button>
              </div>
            </form>
          )}
        </section>
      )}
      {mode !== "summary" && <div className="flex flex-col gap-4 md:hidden">{widgets}</div>}
    </>
  );
}

function Detail({ label, value, wide }: { label: string; value: string | null | undefined; wide?: boolean }) {
  return (
    <div className={`min-w-0 ${wide ? "sm:col-span-2 lg:col-span-4" : ""}`}>
      <dt className="text-[12.5px] text-muted">{label}</dt>
      <dd className="whitespace-pre-wrap break-words">{value || "—"}</dd>
    </div>
  );
}
