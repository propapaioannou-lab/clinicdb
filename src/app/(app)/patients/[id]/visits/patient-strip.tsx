import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ageToday, RiskBadge } from "@/components/patient-bits";
import { Avatar } from "@/components/ui";
import { patientCode } from "@/lib/patients/format";
import type { PatientView } from "@/lib/patients/record";

// Top of the visit screens: who this is, and the alerts that matter during the visit.
export async function PatientStrip({ p, allergies }: { p: PatientView; allergies: string | null }) {
  const t = await getTranslations("patient");
  const th = await getTranslations("history");
  const age = ageToday(p.ageFrom);
  const name = `${p.surname} ${p.firstName}`.trim();
  return (
    <div className="flex flex-col gap-3">
      <Link href={`/patients/${p.id}?tab=visits`} className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold text-primary hover:text-primary-hover">
        <span aria-hidden="true">←</span>
        {t("backToRecord")}
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <Avatar name={name} size={44} />
        <span className="text-[20px] font-semibold">{name}</span>
        <span className="text-sm text-muted">{patientCode(p.number, p.company.code)}{age ? ` · ${t("ageShort", { years: age.years })}` : ""}</span>
        {p.riskFactors.length > 0 && (
          <RiskBadge label={th("risk.title")} reasons={p.riskFactors.map((r) => th(`risk.factors.${r}` as "risk.factors.thyroxine"))} />
        )}
        {(p.infectiousDiseases || p.infectiousHidden) && (
          <span className="rounded-lg bg-danger-bg px-2.5 py-1 text-[13px] font-semibold text-danger-ink">
            {p.infectiousDiseases ? t("infectious", { text: p.infectiousDiseases }) : t("infectiousHidden")}
          </span>
        )}
        {allergies && <span className="rounded-lg bg-danger-bg px-2.5 py-1 text-[13px] font-semibold text-danger-ink">{th("allergyChip", { text: allergies })}</span>}
      </div>
    </div>
  );
}
