import { getTranslations } from "next-intl/server";
import { num1 } from "@/lib/format";
import { card } from "@/components/ui";
import { bmi } from "@/lib/history/data";
import { EXAM_AREAS, findIn, type Catalog } from "@/lib/visits/catalog";
import { difficultyModifiers } from "@/lib/visits/exams/engine";
import { detailsPhrase } from "@/lib/visits/procedure-details";
import type { VisitArea, VisitProcedure } from "@/lib/visits/visits";

// A closed visit (or any visit for read-only users), in the same layout as the form.
export async function VisitView({
  v,
  aside,
  catalog,
}: {
  v: {
    type: string | null;
    doctor: string | null;
    areas: VisitArea[];
    procedures: VisitProcedure[];
    diagnosis: string | null;
    weightKg: number | null;
    heightCm: number | null;
  };
  aside?: React.ReactNode;
  catalog: Catalog;
}) {
  const t = await getTranslations("visit");
  const tb = await getTranslations("exam");
  const b = bmi(v.weightKg ?? undefined, v.heightCm ?? undefined);
  return (
    <div className="flex flex-wrap items-start gap-5">
      <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
        <section className={`${card} flex flex-col gap-3 p-5`}>
          <h2 className="text-[17px] font-semibold">{t("evaluation")}</h2>
          {v.areas.map((a) => (
            <div key={a.area} className="rounded-[12px] border border-line-soft bg-surface-2 p-4">
              <h3 className="mb-1 text-[15px] font-semibold">{EXAM_AREAS.find((d) => d.key === a.area)?.el ?? a.area}</h3>
              {a.exam?.difficulty && (
                <p className="mb-1.5 text-[13px] text-ink-3">
                  {tb("difficultyShort", { rank: a.exam.difficulty })}
                  {difficultyModifiers(a.exam.difficulty).extraMinutes > 0 && ` · ${tb("extraTime", { minutes: difficultyModifiers(a.exam.difficulty).extraMinutes })}`}
                </p>
              )}
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{a.text || "—"}</p>
            </div>
          ))}
          {!v.areas.length && <p className="text-sm text-muted">—</p>}
        </section>
        <section className={`${card} flex flex-col gap-2 p-5`}>
          <h2 className="text-[17px] font-semibold">{t("procedures")}</h2>
          <p className="text-sm">
            {v.procedures.length
              ? v.procedures.map((p) => {
                  const def = findIn(catalog, p.key);
                  const subs = p.subs.map((s) => def?.subs?.find((x) => x.key === s)?.el).filter(Boolean);
                  const spec = detailsPhrase(p.key, p.details);
                  return `${def?.el ?? p.key}${subs.length ? ` (${subs.join(", ")})` : ""}${spec ? `: ${spec}` : ""}`;
                }).join(" · ")
              : t("noneChosen")}
          </p>
          <p className="text-sm"><span className="text-muted">{t("diagnosis")}: </span>{v.diagnosis || "—"}</p>
        </section>
      </div>
      <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-4">
        <section className={`${card} flex flex-col gap-2 p-5 text-sm`}>
          <h2 className="text-[17px] font-semibold">{t("vitals")}</h2>
          <p>{t("weight")}: <b>{num1(v.weightKg)}</b> · {t("height")}: <b>{num1(v.heightCm)}</b> · BMI <b>{num1(b)}</b></p>
        </section>
        {aside}
      </aside>
    </div>
  );
}
