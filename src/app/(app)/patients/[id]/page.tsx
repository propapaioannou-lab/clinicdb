import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { ageToday, FlagDot } from "@/components/patient-bits";
import { requestContext, requireSession } from "@/lib/auth/current";
import { openPatient } from "@/lib/patients/record";
import { loadActor } from "@/lib/users/manage";

export default async function PatientPage({ params }: PageProps<"/patients/[id]">) {
  const session = await requireSession();
  const actor = await loadActor(session.user.id);
  const p = await openPatient(actor, (await params).id, await requestContext());
  if (!p) notFound();
  const t = await getTranslations("patient");
  const tp = await getTranslations("patients");
  const format = await getFormatter();
  const age = ageToday(p.ageFrom);

  return (
    <main className="mx-auto w-full max-w-6xl p-4">
      {p.infectiousDiseases && (
        <div role="alert" className="mb-4 rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white">
          {t("infectiousAlert", { text: p.infectiousDiseases })}
        </div>
      )}
      <header className="flex flex-wrap items-baseline gap-x-6 gap-y-2 border-b border-neutral-200 pb-4 dark:border-neutral-800">
        <h1 className="flex items-center gap-3 text-2xl font-semibold">
          {p.surname} {p.firstName}
          <FlagDot flag={p.flag} label={tp(`flag.${p.flag}`)} />
        </h1>
        <span className="text-neutral-500">{t("number", { number: p.number })}</span>
        {age && <span>{t("age", { years: age.years, months: age.months })}</span>}
        {p.birthDate && <span className="text-neutral-500">{format.dateTime(p.birthDate, { dateStyle: "short", timeZone: "UTC" })}</span>}
        {p.fatherName && <span className="text-neutral-500">{t("father", { name: p.fatherName })}</span>}
        {p.amka && <span className="text-neutral-500">{t("amka", { amka: p.amka })}</span>}
        <span className="text-neutral-500">{p.company}</span>
      </header>
      {p.flag !== "NONE" && (
        <p className={`mt-3 text-sm ${p.flag === "RED" ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-300"}`}>
          {tp(`flag.${p.flag}`)}: {[...p.flagReasons, p.flagNote].filter(Boolean).join(" · ")}
        </p>
      )}
      <p className="mt-6 text-sm text-neutral-500">{t("comingSoon")}</p>
    </main>
  );
}
