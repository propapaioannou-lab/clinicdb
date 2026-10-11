import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ageToday } from "@/components/patient-bits";
import { Badge, card } from "@/components/ui";
import { requestContext, requireSession } from "@/lib/auth/current";
import { canArchivePatients, canEditPatients } from "@/lib/permissions";
import { patientFormOptions } from "@/lib/patients/options";
import { openPatient, type PatientView } from "@/lib/patients/record";
import { loadActor } from "@/lib/users/manage";
import { lastMeasurements, listVisits, moneyTotals, weightSeries } from "@/lib/visits/visits";
import { setArchivedAction, setFlagAction, updatePatientAction } from "../actions";
import type { PatientFormValues } from "../patient-form";
import type { HistoryData } from "@/lib/history/data";
import { canVerifyHistory, HISTORY_SECTIONS, loadHistory, loadHistoryVersion, questionChoices } from "@/lib/history/history";
import { countDocuments, listDocuments } from "@/lib/documents/documents";
import { setDocumentDeletedAction, updateDocumentAction, uploadDocumentsAction } from "./documents-actions";
import { DocumentsTab } from "./record-documents";
import { saveHistoryAction, unverifyHistoryAction, verifyHistoryAction } from "./history-actions";
import { HistoryForm, type QuestionView } from "./history-form";
import { HistoryStatusLine, HistoryView } from "./history-view";
import { PatientCard } from "./patient-card";
import { Timeline, VisitsTab, WeightCard } from "./record-visits";

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

// "11/10/26 · Πρώτη επίσκεψη", for linking a document to a visit.
const visitLabel = (v: { startedAt: Date; type: string | null }) =>
  [new Intl.DateTimeFormat("el-GR", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "Europe/Athens" }).format(v.startedAt), v.type].filter(Boolean).join(" · ");

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

  const history = await loadHistory(actor, p.id);
  const th = await getTranslations("history");
  const questions: QuestionView[] = (history?.questions ?? [])
    .map((q) => ({
      key: q.key,
      section: q.section,
      label: q.labelEl,
      detail: q.detailEl,
      hint: q.hintEl,
      choices: questionChoices(q.choices).map((c) => ({ key: c.key, label: c.labelEl })),
      order: q.sortOrder,
    }))
    .sort((a, b) => HISTORY_SECTIONS.indexOf(a.section) - HISTORY_SECTIONS.indexOf(b.section) || a.order - b.order)
    .map(({ order: _order, ...q }) => q);
  const hd: HistoryData | null = history?.data ?? null;
  const status = history ? (
    <HistoryStatusLine
      status={history.status}
      current={history.current}
      verifiedAt={history.verifiedAt}
      verifiedByName={history.verifiedByName}
      verifiedRole={history.verifiedRole}
      canVerify={canVerifyHistory(actor)}
      verifyAction={verifyHistoryAction.bind(null, p.id)}
      unverifyAction={unverifyHistoryAction.bind(null, p.id)}
    />
  ) : null;
  // Picks + notes, short: "Πενικιλίνη, ΜΣΑΦ · εξάνθημα".
  const picks = (a: { a: string; d?: string; items?: string[] } | undefined, kind: "medItems" | "allergyItems") =>
    !a ? "—" : a.a === "no" ? th("no") : [(a.items ?? []).map((k) => th(`${kind}.${k}` as "medItems.thyroxine")).join(", "), a.d].filter(Boolean).join(" · ") || th("yes");
  const familyYes = questions.filter((q) => q.section === "family" && hd?.answers[q.key]?.a === "yes");
  const keyAnswers = hd
    ? [
        { label: th("short.medication"), value: picks(hd.medication, "medItems") },
        { label: th("short.allergies"), value: picks(hd.allergies, "allergyItems") },
        {
          label: th("short.surgeries"),
          value: !hd.surgeries ? "—" : hd.surgeries.a === "no" || !hd.surgeries.items.length ? th("no") : hd.surgeries.items.map((i) => [i.procedure, i.year].filter(Boolean).join(" ")).join(", "),
        },
        {
          label: th("short.family"),
          value: familyYes.length
            ? familyYes
                .map((q) => {
                  const name = th.has(`short.${q.key}`) ? th(`short.${q.key}` as "short.family") : q.label;
                  const who = [...(hd.answers[q.key].items ?? []).map((k) => q.choices.find((c) => c.key === k)?.label ?? k), hd.answers[q.key].d].filter(Boolean).join(", ");
                  return who ? `${name} (${who})` : name;
                })
                .join(", ") : questions.some((q) => q.section === "family" && hd.answers[q.key]) ? th("no") : "—",
        },
      ]
    : [];
  // Shown on the patient card next to the infectious-disease alert.
  const alerts = [
    ...(hd?.allergies?.a === "yes" ? [{ text: th("allergyChip", { text: picks(hd.allergies, "allergyItems") }), tone: "danger" as const }] : []),
    ...(hd?.smoking && hd.smoking.a !== "no"
      ? [{ text: [th(`smokingChip.${hd.smoking.a}`), hd.smoking.perDay && th(`perDayOptions.${hd.smoking.perDay}`)].filter(Boolean).join(" · "), tone: "neutral" as const }]
      : []),
  ];
  const [visits, totals, series, lastMeas, docCount, docs] = await Promise.all([
    listVisits(actor, p.id).then((v) => v ?? []),
    moneyTotals(actor, p.id),
    weightSeries(p.id),
    lastMeasurements(p.id),
    countDocuments(p.id),
    tab === "documents" ? listDocuments(actor, p.id, sp.deleted === "1").then((d) => d ?? []) : Promise.resolve([]),
  ]);
  const heightForBmi = lastMeas?.heightCm ?? hd?.heightCm ?? null;
  const viewNumber = typeof sp.v === "string" ? Number(sp.v) : null;
  const oldVersion = tab === "history" && viewNumber ? await loadHistoryVersion(actor, p.id, viewNumber) : null;

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
        alerts={alerts}
        widgets={
          <>
            <WeightCard series={series} historyWeight={hd?.weightKg ?? null} heightCm={heightForBmi} maxWeightKg={hd?.maxWeightKg ?? null} />
            <section aria-label={t("history")} className={`${card} flex min-w-0 flex-[1_1_300px] flex-col gap-2.5 px-5 py-[18px]`}>
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <h2 className="flex items-center gap-2 whitespace-nowrap text-[17px] font-semibold">
                  {t("history")}
                  {!hd && <Badge tone="red">{t("historyIncomplete")}</Badge>}
                </h2>
                {editable && (
                  <Link href={`/patients/${p.id}?tab=history&edit=1`} className="text-[13.5px] font-semibold text-primary hover:text-primary-hover">
                    {hd ? th("edit") : th("fillIn")}
                  </Link>
                )}
              </div>
              {hd ? (
                <dl className="grid grid-cols-2 gap-x-3.5 gap-y-2.5 text-sm">
                  {keyAnswers.map((k) => (
                    <div key={k.label} className="min-w-0">
                      <dt className="text-[12.5px] text-muted">{k.label}</dt>
                      <dd className="break-words">{k.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-sm text-muted">{t("historyEmpty")}</p>
              )}
              {status && <div className="mt-auto border-t border-line-softer pt-2">{status}</div>}
            </section>
          </>
        }
      />

      <nav aria-label={t("tabsLabel")} className="flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((x) => {
          const count = x.key === "visits" ? visits.length : x.key === "documents" ? docCount : 0;
          const label = count ? `${t(`tabs.${x.key}`)} · ${count}` : t(`tabs.${x.key}`);
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
              {x.key === "history" && !hd && <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-danger align-middle" title={t("historyIncomplete")} />}
            </Link>
          );
        })}
      </nav>

      {tab === "history" ? (
        editable && sp.edit === "1" ? (
          <HistoryForm patientId={p.id} questions={questions} initial={hd ?? { answers: {} }} action={saveHistoryAction.bind(null, p.id)} />
        ) : (
          <HistoryView
            patientId={p.id}
            questions={questions}
            data={oldVersion ? oldVersion.data : hd}
            editable={editable}
            status={oldVersion ? null : status}
            versions={history?.versions ?? []}
            viewing={oldVersion && history?.current ? { number: oldVersion.number, current: history.current.number } : null}
          />
        )
      ) : tab === "documents" ? (
        <DocumentsTab
          patientId={p.id}
          docs={docs.map((d) => ({
            ...d,
            documentDate: d.documentDate.toISOString().slice(0, 10),
            visit: d.visit ? { id: d.visit.id, label: visitLabel(d.visit) } : null,
          }))}
          visits={visits.map((v) => ({ id: v.id, label: visitLabel(v) }))}
          canEdit={canEditPatients(actor.level)}
          canRestore={canArchivePatients(actor.level)}
          showingDeleted={sp.deleted === "1"}
          upload={uploadDocumentsAction.bind(null, p.id)}
          update={updateDocumentAction.bind(null, p.id)}
          setDeleted={setDocumentDeletedAction.bind(null, p.id)}
        />
      ) : tab === "visits" ? (
        <VisitsTab patientId={p.id} visits={visits} canCreate={canEditPatients(actor.level)} totals={totals} saved={sp.saved === "1"} />
      ) : tab === "overview" ? (
        <div className="flex flex-wrap items-start gap-5">
          <section className={`${card} flex min-w-0 flex-[999_1_480px] flex-col gap-1 px-[22px] py-5`}>
            <div className="mb-2.5 flex items-center justify-between">
              <h2 className="text-[17px] font-semibold">{t("timeline")}</h2>
              <span className="text-[13.5px] text-muted">{t("newestFirst")}</span>
            </div>
            <Timeline patientId={p.id} visits={visits} />
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
