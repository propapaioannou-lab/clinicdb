import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ageToday } from "@/components/patient-bits";
import { card } from "@/components/ui";
import { requestContext, requireSession } from "@/lib/auth/current";
import { canArchivePatients, canEditPatients } from "@/lib/permissions";
import { patientFormOptions } from "@/lib/patients/options";
import { openPatient, type PatientView } from "@/lib/patients/record";
import { loadActor } from "@/lib/users/manage";
import { setArchivedAction, setFlagAction, updatePatientAction } from "../actions";
import type { PatientFormValues } from "../patient-form";
import { PatientCard } from "./patient-card";

const TABS = [
  { key: "overview" },
  { key: "history" },
  { key: "visits" },
  { key: "surgeries", soon: true },
  { key: "treatments", soon: true },
  { key: "photos", soon: true },
  { key: "finance", soon: true },
  { key: "documents" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function formValues(p: PatientView): PatientFormValues | null {
  const c = p.contacts;
  if (!c) return null;
  return {
    surname: p.surname,
    firstName: p.firstName,
    fatherName: p.fatherName ?? "",
    birthDate: c.birthDate
      ? `${String(c.birthDate.getUTCDate()).padStart(2, "0")}/${String(c.birthDate.getUTCMonth() + 1).padStart(2, "0")}/${c.birthDate.getUTCFullYear()}`
      : "",
    sex: p.sex ?? "",
    maritalStatusId: c.form.maritalStatusId ?? "",
    occupation: p.occupation ?? "",
    referralSourceId: c.form.referralSourceId ?? "",
    referralNote: c.referralNote ?? "",
    language: p.language,
    area: c.area ?? "",
    address: c.address ?? "",
    city: c.city ?? "",
    postcode: c.postcode ?? "",
    country: c.country ?? "",
    amka: c.amka ?? "",
    afm: c.afm ?? "",
    taxOfficeId: c.form.taxOfficeId ?? "",
    eprescriptionCity: c.eprescriptionCity ?? "",
    eprescriptionPhone: c.eprescriptionPhone ?? "",
    treatingDoctorId: c.form.treatingDoctorId ?? "",
    ghlContactId: c.ghlContactId ?? "",
    phones: c.phones,
    emails: c.emails,
  };
}

// 2b · Patient record (DESIGN.md): three header cards, then tabs.
export default async function PatientPage({ params, searchParams }: PageProps<"/patients/[id]">) {
  const session = await requireSession();
  const actor = await loadActor(session.user.id);
  const { id } = await params;
  const p = await openPatient(actor, id, await requestContext());
  if (!p) notFound();
  const sp = await searchParams;
  const tab: TabKey = TABS.some((x) => x.key === sp.tab && !("soon" in x)) ? (sp.tab as TabKey) : "overview";

  const t = await getTranslations("patient");
  const editable = canEditPatients(actor.level) && p.contacts !== null;
  const options = editable ? await patientFormOptions(p.company.id) : null;
  const age = ageToday(p.ageFrom);
  const archiveAction = setArchivedAction.bind(null, p.id);

  return (
    <main className="mx-auto flex w-full max-w-[1240px] flex-col gap-5 px-4 py-6 md:px-8">
      {p.archivedAt && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] bg-line-softer px-4 py-3 text-sm">
          <span>{t("archived")}</span>
          {canArchivePatients(actor.level) && (
            <form action={archiveAction.bind(null, false)}>
              <button type="submit" className="font-semibold text-primary hover:text-primary-hover">{t("unarchive")}</button>
            </form>
          )}
        </div>
      )}

      <PatientCard
        p={p}
        age={age}
        editable={editable}
        archivable={canArchivePatients(actor.level)}
        options={options}
        formValues={formValues(p)}
        updateAction={updatePatientAction.bind(null, p.id)}
        flagAction={setFlagAction.bind(null, p.id)}
        archiveAction={archiveAction}
        widgets={
          <>
            <section aria-label={t("weight")} className={`${card} flex min-w-0 flex-[1_1_260px] flex-col gap-2.5 px-5 py-[18px]`}>
              <div className="flex items-baseline justify-between">
                <h2 className="text-[17px] font-semibold">{t("weight")}</h2>
                <span className="text-[22px] font-semibold text-muted">—</span>
              </div>
              <div className="flex h-[90px] items-center justify-center rounded-[10px] bg-surface-2 text-[13px] text-muted">{t("weightEmpty")}</div>
            </section>
            <section aria-label={t("history")} className={`${card} flex min-w-0 flex-[1_1_300px] flex-col gap-2.5 px-5 py-[18px]`}>
              <h2 className="text-[17px] font-semibold">{t("history")}</h2>
              <p className="text-sm text-muted">{t("historyEmpty")}</p>
              <div className="mt-auto border-t border-line-softer pt-2 text-[12.5px] text-muted">{t("historySoon")}</div>
            </section>
          </>
        }
      />

      <nav aria-label={t("tabsLabel")} className="flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((x) => {
          const label = t(`tabs.${x.key}`);
          if ("soon" in x) {
            return (
              <span key={x.key} aria-disabled="true" title={t("soon")} className="whitespace-nowrap px-3.5 py-3 text-[14.5px] font-medium text-ink-3 opacity-45">
                {label} <span className="text-[11px]">· {t("soon")}</span>
              </span>
            );
          }
          const on = tab === x.key;
          return (
            <Link
              key={x.key}
              href={x.key === "overview" ? `/patients/${p.id}` : `/patients/${p.id}?tab=${x.key}`}
              aria-current={on ? "page" : undefined}
              className={`whitespace-nowrap px-3.5 py-3 text-[14.5px] ${on ? "font-semibold text-primary shadow-[inset_0_-2px_0_var(--color-primary)]" : "font-medium text-ink-3 hover:text-ink"}`}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {tab === "overview" ? (
        <div className="flex flex-wrap items-start gap-5">
          <section className={`${card} flex min-w-0 flex-[999_1_480px] flex-col gap-1 px-[22px] py-5`}>
            <div className="mb-2.5 flex items-center justify-between">
              <h2 className="text-[17px] font-semibold">{t("timeline")}</h2>
              <span className="text-[13.5px] text-muted">{t("newestFirst")}</span>
            </div>
            <p className="border-t border-line-softer py-4 text-sm text-muted">{t("timelineEmpty")}</p>
          </section>
          <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
            <section className={`${card} flex flex-col gap-2.5 px-5 py-[18px] opacity-60`}>
              <h2 className="text-[17px] font-semibold">{t("consents")} <span className="text-xs font-medium text-muted">· {t("soon")}</span></h2>
              <p className="text-sm text-muted">{t("consentsSoon")}</p>
            </section>
          </aside>
        </div>
      ) : (
        <section className={`${card} flex flex-col gap-1.5 px-6 py-7`}>
          <h2 className="text-[17px] font-semibold">{t(`tabs.${tab}`)}</h2>
          <p className="text-sm leading-relaxed text-ink-3">{t(`tabSoon.${tab}` as "tabSoon.history")}</p>
        </section>
      )}
    </main>
  );
}
