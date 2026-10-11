import Link from "next/link";
import { num1 } from "@/lib/format";
import { getFormatter, getTranslations } from "next-intl/server";
import { PlusIcon } from "@/components/icons";
import { Badge, card, Notice, primaryButton } from "@/components/ui";
import { bmi } from "@/lib/history/data";
import { findProcedure } from "@/lib/visits/catalog";
import type { listVisits } from "@/lib/visits/visits";

type Visits = NonNullable<Awaited<ReturnType<typeof listVisits>>>;
const euros = (cents: number) => `${(cents / 100).toLocaleString("el-GR", { maximumFractionDigits: 2 })} €`;
const procedureNames = (v: Visits[number]) => v.procedures.map((p) => findProcedure(p.key)?.el ?? p.key).join(", ");

// Επισκέψεις tab (DESIGN.md 2b): newest first, "Νέα επίσκεψη"; money only for money roles.
export async function VisitsTab({
  patientId,
  visits,
  canCreate,
  totals,
  saved,
}: {
  patientId: string;
  visits: Visits;
  canCreate: boolean;
  totals: { fees: number; paid: number; balance: number } | null;
  saved?: boolean;
}) {
  const t = await getTranslations("visit");
  const format = await getFormatter();
  return (
    <div className="flex flex-col gap-4">
      {saved && <Notice>{t("saved")}</Notice>}
      {totals && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className={`${card} flex flex-col gap-1 px-[18px] py-4`}><span className="text-[13px] text-muted">{t("totalFees")}</span><span className="text-[24px] font-semibold">{euros(totals.fees)}</span></div>
          <div className={`${card} flex flex-col gap-1 px-[18px] py-4`}><span className="text-[13px] text-muted">{t("totalPaid")}</span><span className="text-[24px] font-semibold text-ok-ink">{euros(totals.paid)}</span></div>
          <div className={`flex flex-col gap-1 rounded-card border px-[18px] py-4 ${totals.balance > 0 ? "border-warn-line bg-warn-bg/60" : "border-line bg-surface"}`}>
            <span className={`text-[13px] ${totals.balance > 0 ? "text-warn-ink" : "text-muted"}`}>{t("balance")}</span>
            <span className={`text-[24px] font-semibold ${totals.balance > 0 ? "text-warn-ink" : ""}`}>{euros(totals.balance)}</span>
          </div>
        </div>
      )}
      <section className={`${card} overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-5 py-4">
          <h2 className="text-[17px] font-semibold">{t("visitsCount", { count: visits.length })}</h2>
          {canCreate && (
            <Link href={`/patients/${patientId}/visits/new`} className={primaryButton}><PlusIcon />{t("new")}</Link>
          )}
        </div>
        {visits.length === 0 && <p className="px-5 py-6 text-sm text-muted">{t("none")}</p>}
        {visits.map((v) => (
          <Link key={v.id} href={`/patients/${patientId}/visits/${v.id}`} className="flex flex-wrap gap-4 border-b border-line-softer px-5 py-4 hover:bg-surface-2">
            <span className="flex w-[90px] shrink-0 flex-col gap-0.5">
              <span className="text-sm font-semibold tabular-nums">{format.dateTime(v.startedAt, { day: "2-digit", month: "2-digit", year: "2-digit" })}</span>
              <span className="text-[12.5px] text-muted">{format.dateTime(v.startedAt, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}</span>
            </span>
            <span className="flex min-w-0 flex-[1_1_320px] flex-col gap-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-[15px] font-semibold">{v.type ?? t("visit")}</span>
                {v.status === "OPEN" && <Badge tone="amber">{t("open")}</Badge>}
                {v.doctor && <span className="text-[13px] text-muted">· {v.doctor}</span>}
              </span>
              {(v.findings || v.diagnosis) && <span className="line-clamp-2 text-sm leading-relaxed text-ink-3">{[v.diagnosis, v.findings].filter(Boolean).join(" — ")}</span>}
              {v.procedures.length > 0 && <span className="text-[13px] text-ink-3">{procedureNames(v)}</span>}
            </span>
            <span className="flex min-w-[120px] flex-col gap-0.5 text-[13px] text-ink-3">
              {v.weightKg && <span>{t("weightShort")} <b>{num1(v.weightKg)} kg</b></span>}
              {v.money && (
                <span>
                  {v.money.feeCents === null
                    ? t("noCharge")
                    : (v.money.paidCents ?? 0) >= v.money.feeCents
                      ? t("feePaid", { amount: euros(v.money.feeCents) })
                      : t("feeDue", { amount: euros(v.money.feeCents - (v.money.paidCents ?? 0)) })}
                </span>
              )}
            </span>
          </Link>
        ))}
      </section>
    </div>
  );
}

// "Επισκέψεις και χειρουργεία" on the Overview tab (surgeries join in Phase 4).
export async function Timeline({ patientId, visits }: { patientId: string; visits: Visits }) {
  const t = await getTranslations("patient");
  const format = await getFormatter();
  if (!visits.length) return <p className="border-t border-line-softer py-4 text-sm text-muted">{t("timelineEmpty")}</p>;
  return (
    <>
      {visits.slice(0, 8).map((v) => (
        <Link key={v.id} href={`/patients/${patientId}/visits/${v.id}`} className="flex gap-4 border-t border-line-softer py-3.5 hover:bg-surface-2">
          <span className="w-[70px] shrink-0 text-[13.5px] tabular-nums text-muted">{format.dateTime(v.startedAt, { day: "2-digit", month: "2-digit", year: "2-digit" })}</span>
          <span className="mt-[5px] h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-[15px] font-semibold">{[v.type, procedureNames(v)].filter(Boolean).join(" · ") || "—"}</span>
            {(v.diagnosis || v.findings) && <span className="line-clamp-2 text-sm leading-relaxed text-ink-3">{[v.diagnosis, v.findings].filter(Boolean).join(" — ")}</span>}
          </span>
        </Link>
      ))}
    </>
  );
}

// Weight widget: latest weight, BMI, a small trend and the highest weight ever.
export async function WeightCard({
  series,
  historyWeight,
  heightCm,
  maxWeightKg,
}: {
  series: { date: Date; kg: number }[];
  historyWeight: number | null;
  heightCm: number | null;
  maxWeightKg: number | null;
}) {
  const t = await getTranslations("patient");
  const format = await getFormatter();
  const latest = series.at(-1)?.kg ?? historyWeight;
  const b = bmi(latest ?? undefined, heightCm ?? undefined);
  const min = Math.min(...series.map((s) => s.kg));
  const max = Math.max(...series.map((s) => s.kg));
  const span = max - min || 1;
  const pts = series.map((s, i) => ({
    x: series.length === 1 ? 150 : 10 + (i * 280) / (series.length - 1),
    y: 15 + ((max - s.kg) / span) * 60,
  }));
  const first = series[0];
  const change = series.length > 1 ? Math.round((latest! - first.kg) * 10) / 10 : null;
  const highest = Math.max(maxWeightKg ?? 0, max === -Infinity ? 0 : max) || null;
  return (
    <section aria-label={t("weight")} className={`${card} flex min-w-0 flex-[1_1_260px] flex-col gap-2.5 px-5 py-[18px]`}>
      <div className="flex items-baseline justify-between">
        <h2 className="text-[17px] font-semibold">{t("weight")}</h2>
        {latest ? (
          <span className="text-[22px] font-semibold">
            {num1(latest)} kg {b && <span className="text-[13px] font-medium text-muted">BMI {num1(b)}</span>}
          </span>
        ) : (
          <span className="text-[22px] font-semibold text-muted">—</span>
        )}
      </div>
      {series.length > 0 ? (
        <svg role="img" aria-label={t("weightTrend", { list: series.map((s) => num1(s.kg)).join(", ") })} viewBox="0 0 300 90" className="h-[90px] w-full">
          <line x1="0" y1="80" x2="300" y2="80" stroke="var(--color-line-soft)" />
          {pts.length > 1 && (
            <polyline points={pts.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          )}
          {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={i === pts.length - 1 ? 4.5 : 3.5} fill="var(--color-primary)" />)}
        </svg>
      ) : (
        <div className="flex h-[90px] items-center justify-center rounded-[10px] bg-surface-2 text-[13px] text-muted">{t("weightEmpty")}</div>
      )}
      <span className="text-[13px] text-muted">
        {[
          change !== null && first && t("weightChange", { change: `${change > 0 ? "+" : ""}${num1(change)}`, date: format.dateTime(first.date, { month: "long", year: "numeric" }) }),
          highest && t("maxWeight", { kg: num1(highest) }),
        ].filter(Boolean).join(" · ")}
      </span>
    </section>
  );
}
