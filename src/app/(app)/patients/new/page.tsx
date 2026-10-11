import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/current";
import { activeCompany } from "@/lib/company";
import { canEditPatients } from "@/lib/permissions";
import { patientFormOptions } from "@/lib/patients/options";
import { loadActor } from "@/lib/users/manage";
import { createPatientAction, mergeIntoExistingAction } from "../actions";
import { EMPTY_PATIENT, PatientForm } from "../patient-form";

// New patient, in the company chosen in the Ιατρείο | Spa switch.
export default async function NewPatientPage() {
  const session = await requireSession();
  const actor = await loadActor(session.user.id);
  const company = await activeCompany(actor);
  if (!canEditPatients(actor.level) || !company) notFound();
  const [options, t, tc] = await Promise.all([patientFormOptions(company.id), getTranslations("patientForm"), getTranslations("companies")]);

  return (
    <main className="mx-auto flex w-full max-w-[1000px] flex-col gap-5 px-4 py-7 md:px-8">
      <div>
        <h1 className="text-[28px] font-semibold">{t("newTitle")}</h1>
        <p className="text-sm text-muted">{t("newIntro", { company: tc(company.code as "surgery") })}</p>
      </div>
      <PatientForm mode="create" initial={EMPTY_PATIENT} options={options} action={createPatientAction} mergeAction={mergeIntoExistingAction} />
    </main>
  );
}
