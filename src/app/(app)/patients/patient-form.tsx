"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import type { PhoneType } from "@/generated/prisma/client";
import { PlusIcon } from "@/components/icons";
import { ErrorBox, inputClass, Notice, primaryButton, secondaryButton } from "@/components/ui";
import type { PatientFormOptions } from "@/lib/patients/options";
import type { PatientFormState } from "./actions";
import { EmailInput, PhoneInput } from "./contact-inputs";
import { DuplicatePanel, type MergeChoices } from "./duplicate-panel";

export type PatientFormValues = {
  surname: string;
  firstName: string;
  fatherName: string;
  birthDate: string; // dd/mm/yyyy
  sex: string;
  maritalStatusId: string;
  occupation: string;
  referralSourceId: string;
  referralNote: string;
  language: "EL" | "EN";
  area: string;
  address: string;
  city: string;
  postcode: string;
  country: string;
  amka: string;
  afm: string;
  taxOfficeId: string;
  eprescriptionCity: string;
  eprescriptionPhone: string;
  treatingDoctorId: string;
  ghlContactId: string;
  phones: { number: string; type: PhoneType; isMain: boolean }[];
  emails: string[];
};

export const EMPTY_PATIENT: PatientFormValues = {
  surname: "", firstName: "", fatherName: "", birthDate: "", sex: "", maritalStatusId: "", occupation: "",
  referralSourceId: "", referralNote: "", language: "EL", area: "", address: "", city: "", postcode: "",
  country: "", amka: "", afm: "", taxOfficeId: "", eprescriptionCity: "", eprescriptionPhone: "",
  treatingDoctorId: "", ghlContactId: "",
  phones: [{ number: "", type: "MOBILE", isMain: true }], emails: [""],
};

const PHONE_TYPES: PhoneType[] = ["MOBILE", "HOME", "WORK", "OTHER"];

export function PatientForm({
  mode,
  initial,
  options,
  action,
  mergeAction,
  onCancel,
  onSaved,
}: {
  mode: "create" | "edit";
  initial: PatientFormValues;
  options: PatientFormOptions;
  action: (fd: FormData) => Promise<PatientFormState>;
  mergeAction?: (existingId: string, fd: FormData) => Promise<PatientFormState>;
  onCancel?: () => void;
  // Called after a successful save (edit mode closes the form).
  onSaved?: () => void;
}) {
  const t = useTranslations("patientForm");
  const [state, setState] = useState<PatientFormState>({});
  const [pending, start] = useTransition();
  // Each row keeps its own key, so removing one row never shifts typed values.
  const nextKey = useRef(0);
  const keyed = <T,>(items: T[]) => items.map((item) => ({ ...item, key: nextKey.current++ }));
  const [phones, setPhones] = useState(() => keyed(initial.phones.length ? initial.phones : EMPTY_PATIENT.phones));
  const [emails, setEmails] = useState(() => keyed((initial.emails.length ? initial.emails : [""]).map((value) => ({ value }))));
  const lastFd = useRef<FormData | null>(null);
  const panel = useRef<HTMLDivElement>(null);

  const run = (fn: () => Promise<PatientFormState>) =>
    start(async () => {
      const r = await fn();
      if (r.saved && onSaved) {
        onSaved();
        return;
      }
      setState(r);
      if (r.duplicates?.length || r.error) setTimeout(() => panel.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    lastFd.current = fd;
    run(() => action(fd));
  };
  const copy = () => {
    const fd = new FormData();
    lastFd.current?.forEach((v, k) => fd.append(k, v));
    return fd;
  };
  const saveAnyway = (ids: string[]) => {
    const fd = copy();
    fd.set("confirmed", "1");
    ids.forEach((id) => fd.append("notDuplicateOf", id));
    run(() => action(fd));
  };
  const merge = (existingId: string, c: MergeChoices) => {
    if (!mergeAction) return;
    const fd = copy();
    c.takeNew.forEach((k) => fd.append("takeNew", k));
    c.addPhones.forEach((p) => fd.append("addPhone", p));
    c.addEmails.forEach((e) => fd.append("addEmail", e));
    run(() => mergeAction(existingId, fd));
  };

  const field = (name: keyof PatientFormValues, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block text-sm font-medium text-ink-2">
      {label}
      <input name={name} defaultValue={initial[name] as string} className={inputClass} {...props} />
    </label>
  );
  const select = (name: keyof PatientFormValues, label: string, items: { id: string; label: string }[]) => (
    <label className="block text-sm font-medium text-ink-2">
      {label}
      <select name={name} defaultValue={initial[name] as string} className={inputClass}>
        <option value="">—</option>
        {items.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
      </select>
    </label>
  );
  const group = (title: string, children: React.ReactNode, cols = "sm:grid-cols-3") => (
    <section className="rounded-[14px] border border-line bg-surface p-4 md:p-5">
      <h3 className="mb-3 text-[15px] font-semibold">{title}</h3>
      <div className={`grid gap-3 ${cols}`}>{children}</div>
    </section>
  );

  return (
    <div className="flex flex-col gap-4">
      <div ref={panel} className="scroll-mt-28">
        {state.error && <ErrorBox>{t(`errors.${state.error}`)}</ErrorBox>}
        {state.saved && <Notice>{t("saved")}</Notice>}
        {state.duplicates && state.duplicates.length > 0 && lastFd.current && (
          <DuplicatePanel
            mode={mode}
            duplicates={state.duplicates}
            submitted={lastFd.current}
            pending={pending}
            onSaveAnyway={saveAnyway}
            onMerge={mode === "create" ? merge : undefined}
            onBack={() => setState({})}
          />
        )}
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <fieldset disabled={pending || Boolean(state.duplicates?.length)} className="flex flex-col gap-4 disabled:opacity-70">
          {group(t("name"), <>
            {field("surname", t("surname"), { required: true, autoFocus: mode === "create" })}
            {field("firstName", t("firstName"))}
            {field("fatherName", t("fatherName"))}
            {field("birthDate", t("birthDate"), {
              // Always day/month/year, whatever language the browser is set to.
              placeholder: t("datePlaceholder"),
              inputMode: "numeric",
              pattern: "\\d{1,2}/\\d{1,2}/\\d{4}",
              title: t("datePlaceholder"),
            })}
            <label className="block text-sm font-medium text-ink-2">
              {t("sex")}
              <select name="sex" defaultValue={initial.sex} className={inputClass}>
                <option value="">—</option>
                <option value="FEMALE">{t("sexes.FEMALE")}</option>
                <option value="MALE">{t("sexes.MALE")}</option>
                <option value="TRANS_MAN">{t("sexes.TRANS_MAN")}</option>
                <option value="TRANS_WOMAN">{t("sexes.TRANS_WOMAN")}</option>
                <option value="NON_BINARY">{t("sexes.NON_BINARY")}</option>
              </select>
            </label>
            <label className="block text-sm font-medium text-ink-2">
              {t("language")}
              <select name="language" defaultValue={initial.language} className={inputClass}>
                <option value="EL">{t("languages.EL")}</option>
                <option value="EN">{t("languages.EN")}</option>
              </select>
            </label>
          </>)}

          {group(t("contact"), <>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <span className="text-sm font-medium text-ink-2">{t("phones")}</span>
              {phones.map((p, i) => (
                <div key={p.key} className="grid grid-cols-[minmax(0,1fr)_auto_1.5rem] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_auto_1.5rem]">
                  <PhoneInput defaultValue={p.number} label={t("phone")} codeLabel={t("countryCode")} className="col-span-3 sm:col-span-1" />
                  <select name="phoneType" defaultValue={p.type} aria-label={t("phoneType")} className={`${inputClass} mt-0`}>
                    {PHONE_TYPES.map((pt) => <option key={pt} value={pt}>{t(`phoneTypes.${pt}`)}</option>)}
                  </select>
                  <label className="flex items-center gap-1.5 text-sm text-ink-3">
                    <input type="radio" name="phoneMain" value={i} defaultChecked={p.isMain} className="accent-primary" />
                    {t("main")}
                  </label>
                  {phones.length > 1 && (
                    <button type="button" onClick={() => setPhones(phones.filter((_, j) => j !== i))} className="text-sm text-muted hover:text-danger" aria-label={t("remove")}>✕</button>
                  )}
                </div>
              ))}
              <button type="button" onClick={() => setPhones([...phones, ...keyed([{ number: "", type: "MOBILE" as PhoneType, isMain: false }])])} className="inline-flex items-center gap-1 self-start text-sm font-semibold text-primary">
                <PlusIcon size={15} />{t("addPhone")}
              </button>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-ink-2">{t("emails")}</span>
              {emails.map((e, i) => (
                <div key={e.key} className="flex items-start gap-2">
                  <EmailInput defaultValue={e.value} label={t("email")} error={t("errors.invalid_email")} />
                  {emails.length > 1 && (
                    <button type="button" onClick={() => setEmails(emails.filter((_, j) => j !== i))} className="text-sm text-muted hover:text-danger" aria-label={t("remove")}>✕</button>
                  )}
                </div>
              ))}
              <button type="button" onClick={() => setEmails([...emails, ...keyed([{ value: "" }])])} className="inline-flex items-center gap-1 self-start text-sm font-semibold text-primary">
                <PlusIcon size={15} />{t("addEmail")}
              </button>
            </div>
          </>)}

          {group(t("addressGroup"), <>
            {field("address", t("address"))}
            {field("area", t("area"))}
            {field("city", t("city"))}
            {field("postcode", t("postcode"), { inputMode: "numeric" })}
            {field("country", t("country"))}
          </>)}

          {group(t("other"), <>
            {select("maritalStatusId", t("maritalStatus"), options.marital)}
            {field("occupation", t("occupation"))}
            {select("treatingDoctorId", t("treatingDoctor"), options.doctors.map((d) => ({ id: d.id, label: d.name })))}
            {select("referralSourceId", t("referralSource"), options.referral)}
            <div className="sm:col-span-2">{field("referralNote", t("referralNote"))}</div>
          </>)}

          {group(t("taxGroup"), <>
            {field("amka", t("amka"), { inputMode: "numeric", maxLength: 11, pattern: "\\d{11}", title: t("errors.invalid_amka") })}
            {field("afm", t("afm"), { inputMode: "numeric", maxLength: 9, pattern: "\\d{9}", title: t("errors.invalid_afm") })}
            {select("taxOfficeId", t("taxOffice"), options.taxOffices)}
            {field("eprescriptionCity", t("eprescriptionCity"))}
            {field("eprescriptionPhone", t("eprescriptionPhone"), { type: "tel" })}
          </>)}

          <input type="hidden" name="ghlContactId" defaultValue={initial.ghlContactId} />
        </fieldset>

        {!state.duplicates?.length && (
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={pending} className={primaryButton}>
              {pending ? t("saving") : mode === "create" ? t("create") : t("save")}
            </button>
            {onCancel && <button type="button" onClick={onCancel} className={secondaryButton}>{t("cancel")}</button>}
          </div>
        )}
      </form>
    </div>
  );
}
