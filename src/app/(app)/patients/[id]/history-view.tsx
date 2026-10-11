import Link from "next/link";
import { num1 } from "@/lib/format";
import { getFormatter, getTranslations } from "next-intl/server";
import { Badge, card, primaryButton } from "@/components/ui";
import type { HistorySource, HistoryStatus, Role } from "@/generated/prisma/client";
import { bmi, type HistoryData } from "@/lib/history/data";
import type { QuestionView } from "./history-form";

type StatusProps = {
  status: HistoryStatus | null;
  current: { number: number; source: HistorySource; createdByName: string | null; createdAt: Date } | null;
  verifiedAt: Date | null;
  verifiedByName: string | null;
  verifiedRole: Role | null;
  canVerify: boolean;
  verifyAction: () => Promise<void>;
  unverifyAction: () => Promise<void>;
};

// Footer of the history widget and top of the history tab (DESIGN.md 2b): who filled it
// in, and "Εκκρεμεί επιβεβαίωση" + Επιβεβαίωση ✓, or "✓ Επιβεβαιώθηκε · name (role) · when".
export async function HistoryStatusLine(p: StatusProps) {
  const t = await getTranslations("history");
  const tr = await getTranslations("roles");
  const format = await getFormatter();
  if (!p.current) return null;
  const when = (d: Date) => format.dateTime(d, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const filled = p.current.source === "PATIENT" ? t("filledByPatient", { date: when(p.current.createdAt) }) : t("filledBy", { name: p.current.createdByName ?? "—", date: when(p.current.createdAt) });
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="flex-1 text-[12.5px] text-muted">{filled}</span>
      {p.status === "PENDING" && (
        <>
          <Badge tone="amber">{t("pending")}</Badge>
          {p.canVerify && (
            <form action={p.verifyAction}>
              <button type="submit" className="h-[30px] rounded-lg bg-primary px-3 text-[13px] font-semibold text-white hover:bg-primary-hover">{t("verify")}</button>
            </form>
          )}
        </>
      )}
      {p.status === "VERIFIED" && (
        <>
          <Badge tone="green">
            {t("verified", { name: p.verifiedByName ?? "—", role: p.verifiedRole ? tr(p.verifiedRole) : "", date: p.verifiedAt ? when(p.verifiedAt) : "" })}
          </Badge>
          {p.canVerify && (
            <form action={p.unverifyAction}>
              <button type="submit" className="h-[30px] rounded-lg border border-line-strong bg-surface px-2.5 text-[12.5px] text-ink-3 hover:bg-surface-2">{t("undo")}</button>
            </form>
          )}
        </>
      )}
    </div>
  );
}

// The whole history, read-only: Yes answers first and prominent, No answers compact.
export async function HistoryView({
  patientId,
  questions,
  data,
  editable,
  status,
  versions,
  viewing,
}: {
  patientId: string;
  questions: QuestionView[];
  data: HistoryData | null;
  editable: boolean;
  status: React.ReactNode;
  versions: { number: number; source: HistorySource; createdByName: string | null; createdAt: Date }[];
  viewing: { number: number; current: number } | null;
}) {
  const t = await getTranslations("history");
  const format = await getFormatter();
  const date = (d: Date) => format.dateTime(d, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

  if (!data) {
    return (
      <section className={`${card} flex flex-col items-start gap-3 px-6 py-7`}>
        <h2 className="text-[17px] font-semibold">{t("title")}</h2>
        <p className="text-sm text-ink-3">{t("empty")}</p>
        {editable && <Link href={`/patients/${patientId}?tab=history&edit=1`} className={primaryButton}>{t("fillIn")}</Link>}
      </section>
    );
  }

  // Picks + notes, e.g. "Θυροξίνη (Eltroxin, T4), Υπνωτικά · Eltroxin 50 mcg".
  const picks = (a: { a: string; d?: string; items?: string[] } | undefined, kind: "medItems" | "allergyItems") =>
    !a ? "—" : a.a === "no" ? t("no") : [ (a.items ?? []).map((k) => t(`${kind}.${k}` as "medItems.thyroxine")).join(", "), a.d ].filter(Boolean).join(" · ") || t("yes");
  const b = bmi(data.weightKg, data.heightCm);
  const sections = [...new Set(questions.map((q) => q.section))];
  const smoking = data.smoking
    ? [t(`smokingStatus.${data.smoking.a}`), data.smoking.perDay && t(`perDayOptions.${data.smoking.perDay}`), data.smoking.product && t(`products.${data.smoking.product}`), data.smoking.quit]
        .filter(Boolean)
        .join(" · ")
    : "—";

  return (
    <div className="flex flex-wrap items-start gap-5">
      <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
        {viewing && viewing.number !== viewing.current && (
          <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] bg-info-bg px-4 py-3 text-sm text-info-ink">
            <span>{t("viewingOld", { number: viewing.number })}</span>
            <Link href={`/patients/${patientId}?tab=history`} className="font-semibold">{t("backToCurrent")}</Link>
          </div>
        )}
        <section className={`${card} flex flex-col gap-3 p-5`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[17px] font-semibold">{t("title")}</h2>
            {editable && (!viewing || viewing.number === viewing.current) && (
              <Link href={`/patients/${patientId}?tab=history&edit=1`} className="text-[13.5px] font-semibold text-primary hover:text-primary-hover">{t("edit")}</Link>
            )}
          </div>
          {status}
          <dl className="grid gap-x-6 gap-y-3 border-t border-line-softer pt-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <Item label={t("medication")} value={picks(data.medication, "medItems")} strong={data.medication?.a === "yes"} />
            <Item label={t("allergies")} value={picks(data.allergies, "allergyItems")} strong={data.allergies?.a === "yes"} danger={data.allergies?.a === "yes"} />
            <Item label={t("smoking")} value={smoking} strong={data.smoking?.a === "yes"} />
            <Item label={t("weight")} value={data.weightKg ? `${num1(data.weightKg)} kg${b ? ` · BMI ${num1(b)}` : ""}` : "—"} />
            <Item label={t("maxWeight")} value={data.maxWeightKg ? `${num1(data.maxWeightKg)} kg` : "—"} />
            <Item label={t("height")} value={data.heightCm ? `${num1(data.heightCm)} cm` : "—"} />
          </dl>
        </section>

        {sections.map((s) => {
          const qs = questions.filter((q) => q.section === s);
          const yes = qs.filter((q) => data.answers[q.key]?.a === "yes");
          const no = qs.filter((q) => data.answers[q.key]?.a === "no");
          const open = qs.length - yes.length - no.length;
          return (
            <section key={s} className={`${card} flex flex-col gap-2 p-5`}>
              <h2 className="text-[15px] font-semibold">{t(`sections.${s}` as "sections.heart")}</h2>
              {yes.map((q) => (
                <p key={q.key} className="text-sm">
                  <span className="mr-2 inline-block rounded-full bg-warn-bg px-2 py-0.5 text-xs font-semibold text-warn-ink">{t("yes")}</span>
                  <span className="font-semibold">{q.label}</span>
                  {(() => {
                    const a = data.answers[q.key];
                    const more = [...(a.items ?? []).map((k) => q.choices.find((c) => c.key === k)?.label ?? k), a.d].filter(Boolean).join(", ");
                    return more ? <span className="text-ink-3"> — {more}</span> : null;
                  })()}
                </p>
              ))}
              {no.length > 0 && <p className="text-[13px] text-muted">{t("noList", { list: no.map((q) => q.label).join(" · ") })}</p>}
              {open > 0 && <p className="text-[13px] text-muted">{t("unanswered", { count: open })}</p>}
            </section>
          );
        })}

        <section className={`${card} flex flex-col gap-2 p-5`}>
          <h2 className="text-[15px] font-semibold">{t("surgeries")}</h2>
          {!data.surgeries ? (
            <p className="text-sm text-muted">—</p>
          ) : data.surgeries.a === "no" || !data.surgeries.items.length ? (
            <p className="text-sm">{t("no")}</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {data.surgeries.items.map((it, i) => (
                <li key={i}>
                  <span className="font-semibold">{it.procedure}</span>
                  {it.year && <span> · {it.year}</span>}
                  {it.complications && <span className="text-ink-3"> · {it.complications}</span>}
                </li>
              ))}
            </ul>
          )}
          {data.surgeries?.notes && <p className="text-sm text-ink-3">{data.surgeries.notes}</p>}
        </section>

        {data.notes && (
          <section className={`${card} flex flex-col gap-2 p-5`}>
            <h2 className="text-[15px] font-semibold">{t("notes")}</h2>
            <p className="whitespace-pre-wrap text-sm">{data.notes}</p>
          </section>
        )}
      </div>

      <aside className={`${card} flex min-w-0 flex-[1_1_280px] flex-col gap-2 p-5`}>
        <h2 className="text-[15px] font-semibold">{t("versions")}</h2>
        <ul className="flex flex-col text-sm">
          {versions.map((v, i) => {
            const on = viewing ? viewing.number === v.number : i === 0;
            return (
              <li key={v.number} className="border-t border-line-softer py-2 first:border-t-0">
                <Link href={i === 0 ? `/patients/${patientId}?tab=history` : `/patients/${patientId}?tab=history&v=${v.number}`} className={on ? "font-semibold text-primary" : "text-ink-2 hover:text-primary"}>
                  {t("version", { number: v.number })}{i === 0 ? ` · ${t("current")}` : ""}
                </Link>
                <span className="block text-xs text-muted">
                  {v.source === "PATIENT" ? t("sourcePatient") : v.createdByName ?? "—"} · {date(v.createdAt)}
                </span>
              </li>
            );
          })}
        </ul>
      </aside>
    </div>
  );
}

function Item({ label, value, strong, danger }: { label: string; value: string; strong?: boolean; danger?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12.5px] text-muted">{label}</dt>
      <dd className={`break-words ${strong ? "font-semibold" : ""} ${danger ? "text-danger-ink" : ""}`}>{value}</dd>
    </div>
  );
}
