import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Badge, card, secondaryButton } from "@/components/ui";
import { requestContext, requireSession } from "@/lib/auth/current";
import { canCloseVisit, canEditPatients, canReopenVisit } from "@/lib/permissions";
import { openPatient } from "@/lib/patients/record";
import { num1 } from "@/lib/format";
import { athensDateTimeFields } from "@/lib/time";
import { loadActor } from "@/lib/users/manage";
import { getVisit } from "@/lib/visits/visits";
import { setChargeAction, setClosedAction, updateVisitAction } from "../actions";
import { ChargePanel } from "../charge-panel";
import { PatientStrip } from "../patient-strip";
import { allergySummary, shortDate, visitTypes } from "../shared";
import { VisitForm } from "../visit-form";
import { VisitView } from "../visit-view";

export default async function VisitPage({ params, searchParams }: PageProps<"/patients/[id]/visits/[visitId]">) {
  const session = await requireSession();
  const actor = await loadActor(session.user.id);
  const { id, visitId } = await params;
  const v = await getVisit(actor, visitId);
  if (!v || v.patientId !== id) notFound();
  const p = await openPatient(actor, id, await requestContext());
  if (!p) notFound();
  const [types, allergies, t] = await Promise.all([visitTypes(v.companyId), allergySummary(actor, p.id), getTranslations("visit")]);
  const editable = canEditPatients(actor.level) && v.status === "OPEN";
  const when = athensDateTimeFields(v.startedAt);

  const aside = (
    <>
      {v.money && <ChargePanel money={v.money} action={setChargeAction.bind(null, p.id, v.id)} />}
      {v.previous && (
        <section className={`${card} flex flex-col gap-1.5 p-5`}>
          <h2 className="text-[17px] font-semibold">{t("previous")}</h2>
          <span className="text-sm text-muted">{await shortDate(v.previous.startedAt)} · {v.previous.type ?? "—"}</span>
          <p className="line-clamp-4 text-sm">{v.previous.general || v.previous.diagnosis || "—"}</p>
        </section>
      )}
      {v.status === "CLOSED" && canReopenVisit(actor) && (
        <form action={setClosedAction.bind(null, p.id, v.id, false)}>
          <button type="submit" className={`${secondaryButton} w-full`}>{t("reopen")}</button>
        </form>
      )}
    </>
  );

  return (
    <main className="mx-auto flex w-full max-w-[1240px] flex-col gap-5 px-4 py-6 md:px-8">
      <PatientStrip p={p} allergies={allergies.text} />
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[26px] font-semibold">{v.type ?? t("visit")}</h1>
        <span className="text-muted">{when.date} {when.time}{v.doctor ? ` · ${v.doctor}` : ""}</span>
        <Badge tone={v.status === "OPEN" ? "amber" : "green"}>{v.status === "OPEN" ? t("open") : t("closed")}</Badge>
      </div>
      {editable ? (
        <VisitForm
          types={types}
          initial={{
            typeId: v.typeId ?? "", date: when.date, time: when.time, general: v.general ?? "", areas: v.areas, procedures: v.procedures,
            diagnosis: v.diagnosis ?? "", weightKg: v.weightKg !== null ? num1(v.weightKg) : "", heightCm: v.heightCm !== null ? num1(v.heightCm) : "",
            bp: v.bpSystolic && v.bpDiastolic ? `${v.bpSystolic}/${v.bpDiastolic}` : "", pulse: v.pulse?.toString() ?? "",
          }}
          previousWeight={v.previous?.weightKg ? { kg: v.previous.weightKg, date: await shortDate(v.previous.startedAt) } : null}
          action={updateVisitAction.bind(null, p.id, v.id)}
          closeAction={canCloseVisit(actor) ? setClosedAction.bind(null, p.id, v.id, true) : undefined}
          aside={aside}
          savedNotice={(await searchParams).saved === "1"}
        />
      ) : (
        <VisitView v={v} aside={aside} />
      )}
    </main>
  );
}
