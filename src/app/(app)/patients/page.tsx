import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ageToday, FlagDot } from "@/components/patient-bits";
import { requireSession } from "@/lib/auth/current";
import { canSeeContactDetails } from "@/lib/permissions";
import { listPatients, listUserCompanies } from "@/lib/patients/queries";
import { loadActor } from "@/lib/users/manage";

export default async function PatientsPage({ searchParams }: PageProps<"/patients">) {
  const session = await requireSession();
  const actor = await loadActor(session.user.id);
  const sp = await searchParams;
  const companyId = typeof sp.company === "string" ? sp.company : undefined;
  const page = Number(sp.page) || 1;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 100) : "";

  const [{ rows, total, pages }, companies] = await Promise.all([
    listPatients(actor, { page, companyId, q }),
    listUserCompanies(actor),
  ]);
  const t = await getTranslations("patients");
  const contacts = canSeeContactDetails(actor.level);
  const showCompany = companies.length > 1 && !companyId;

  const href = (p: number, c = companyId, query = q) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (c) params.set("company", c);
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return s ? `/patients?${s}` : "/patients";
  };
  const tab = (active: boolean) =>
    `rounded-md px-3 py-1 text-sm ${active ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900" : "hover:bg-neutral-100 dark:hover:bg-neutral-800"}`;

  return (
    <main className="mx-auto w-full max-w-6xl p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">
          {q ? t("resultsFor", { q }) : t("title")} <span className="text-base font-normal text-neutral-500">{t("count", { count: total })}</span>
        </h1>
        {companies.length > 1 && (
          <nav className="flex gap-1">
            <Link href={href(1, "")} className={tab(!companyId)}>{t("allCompanies")}</Link>
            {companies.map((c) => (
              <Link key={c.id} href={href(1, c.id)} className={tab(companyId === c.id)}>{c.name}</Link>
            ))}
          </nav>
        )}
      </div>

      {q && (
        <p className="mb-3 text-sm">
          <Link href={href(1, companyId, "")} className="underline-offset-2 hover:underline">{t("clearSearch")}</Link>
        </p>
      )}
      {rows.length === 0 && <p className="text-sm text-neutral-500">{t("none")}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 text-neutral-500 dark:border-neutral-800">
            <tr>
              <th className="py-2 pr-4">{t("number")}</th>
              <th className="py-2 pr-4">{t("name")}</th>
              <th className="py-2 pr-4">{t("fatherName")}</th>
              <th className="py-2 pr-4">{t("age")}</th>
              {contacts && <th className="py-2 pr-4">{t("phone")}</th>}
              {contacts && <th className="py-2 pr-4">{t("city")}</th>}
              {showCompany && <th className="py-2 pr-4">{t("company")}</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const age = ageToday(p.birthDate);
              return (
                <tr key={p.id} className="border-b border-neutral-100 dark:border-neutral-900">
                  <td className="py-2 pr-4 tabular-nums text-neutral-500">{p.number}</td>
                  <td className="py-2 pr-4">
                    <span className="flex items-center gap-2">
                      <Link href={`/patients/${p.id}`} className="font-medium underline-offset-2 hover:underline">{p.surname} {p.firstName}</Link>
                      <FlagDot flag={p.flag} label={t(`flag.${p.flag}`)} />
                      {p.infectiousDiseases && <span title={t("infectious")} className="text-xs font-semibold text-red-700 dark:text-red-400">⚠</span>}
                    </span>
                  </td>
                  <td className="py-2 pr-4">{p.fatherName}</td>
                  <td className="py-2 pr-4 tabular-nums">{age ? t("years", { years: age.years }) : ""}</td>
                  {contacts && <td className="py-2 pr-4 tabular-nums">{p.phones?.[0]?.number}</td>}
                  {contacts && <td className="py-2 pr-4">{p.city}</td>}
                  {showCompany && <td className="py-2 pr-4 text-neutral-500">{p.company.name}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-center gap-4 text-sm">
          {page > 1 ? <Link href={href(page - 1)} className="hover:underline">← {t("previous")}</Link> : <span />}
          <span className="text-neutral-500">{t("page", { page, pages })}</span>
          {page < pages ? <Link href={href(page + 1)} className="hover:underline">{t("next")} →</Link> : <span />}
        </nav>
      )}
    </main>
  );
}
