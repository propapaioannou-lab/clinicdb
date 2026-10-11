import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { card } from "@/components/ui";
import { requestContext, requireSession } from "@/lib/auth/current";
import { canEditPatients, canHandleMoney } from "@/lib/permissions";
import { openPatient } from "@/lib/patients/record";
import { num1 } from "@/lib/format";
import { athensDateTimeFields } from "@/lib/time";
import { loadActor } from "@/lib/users/manage";
import { lastMeasurements, listVisits } from "@/lib/visits/visits";
import { createVisitAction } from "../actions";
import { PatientStrip } from "../patient-strip";
import { allergySummary, shortDate, visitTypes } from "../shared";
import { VisitForm } from "../visit-form";

// 3 · New visit (DESIGN.md).
export default async function NewVisitPage({ params }: PageProps<"/patients/[id]/visits/new">) {
  const session = await requireSession();
  const actor = await loadActor(session.user.id);
  const { id } = await params;
  if (!canEditPatients(actor.level)) notFound();
  const p = await openPatient(actor, id, await requestContext());
  if (!p) notFound();
  const [types, last, visits, allergies, t] = await Promise.all([
    visitTypes(p.company.id),
    lastMeasurements(p.id),
    listVisits(actor, p.id),
    allergySummary(actor, p.id),
    getTranslations("visit"),
  ]);
  const now = athensDateTimeFields(new Date());
  // A patient's first visit is the consultation; later ones start without a type chosen.
  const firstType = visits?.length ? "" : (types.find((ty) => ty.chargeable)?.id ?? "");
  const height = last?.heightCm ?? allergies.history?.heightCm ?? null;
  const prev = visits?.[0];

  return (
    <main className="mx-auto flex w-full max-w-[1240px] flex-col gap-5 px-4 py-6 md:px-8">
      <PatientStrip p={p} allergies={allergies.text} />
      <h1 className="text-[26px] font-semibold">{t("newTitle")}</h1>
      <VisitForm
        types={types}
        initial={{
          typeId: firstType, date: now.date, time: now.time, general: "", areas: [], procedures: [], diagnosis: "",
          weightKg: "", heightCm: height ? num1(height) : "",
        }}
        previousWeight={last?.weightKg ? { kg: last.weightKg, date: await shortDate(last.startedAt) } : null}
        action={createVisitAction.bind(null, p.id)}
        aside={
          <>
            {canHandleMoney(actor) && <section className={`${card} p-5 text-sm text-muted`}>{t("chargeAfterSave")}</section>}
            {prev && (
              <section className={`${card} flex flex-col gap-1.5 p-5`}>
                <h2 className="text-[17px] font-semibold">{t("previous")}</h2>
                <span className="text-sm text-muted">{await shortDate(prev.startedAt)} · {prev.type ?? "—"}</span>
                <p className="line-clamp-4 text-sm">{prev.general || prev.diagnosis || "—"}</p>
              </section>
            )}
          </>
        }
      />
    </main>
  );
}
