import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { PlusIcon } from "@/components/icons";
import { ageToday, FlagDot } from "@/components/patient-bits";
import { Avatar, Badge, card, primaryButton } from "@/components/ui";
import { requireSession } from "@/lib/auth/current";
import { activeCompany, userCompanies } from "@/lib/company";
import { canEditPatients, canSeeContactDetails } from "@/lib/permissions";
import { patientCode } from "@/lib/patients/format";
import { listPatients, recentlyOpened } from "@/lib/patients/queries";
import { loadActor } from "@/lib/users/manage";
import { SearchBox } from "./search-box";

// 2a · Patients (DESIGN.md): big search, filter chips, recently opened.
export default async function PatientsPage({ searchParams }: PageProps<"/patients">) {
  const session = await requireSession();
  const actor = await loadActor(session.user.id);
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 100) : "";
  const f = typeof sp.f === "string" ? sp.f : "";
  const page = Number(sp.page) || 1;

  const [companies, current] = await Promise.all([userCompanies(actor.companyIds), activeCompany(actor)]);
  const t = await getTranslations("patients");
  const tc = await getTranslations("companies");
  const format = await getFormatter();
  const contacts = canSeeContactDetails(actor.level);

  // Default: the company chosen in the Ιατρείο | Spa switch. "all" = all the user's companies.
  const chosen = companies.find((c) => c.code === f);
  const companyId = f === "all" || f === "flagged" ? undefined : (chosen?.id ?? current?.id ?? "none");
  const activeChip = f === "all" || f === "flagged" ? f : (chosen?.code ?? current?.code ?? "");
  const flagged = f === "flagged";
  const listing = Boolean(q.trim()) || flagged;

  const [result, recent] = await Promise.all([
    listing ? listPatients(actor, { page, companyId, q, flagged }) : null,
    listing ? [] : recentlyOpened(actor),
  ]);

  const href = (over: { f?: string; page?: number }) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    const nf = over.f ?? f;
    if (nf) params.set("f", nf);
    if (over.page && over.page > 1) params.set("page", String(over.page));
    const s = params.toString();
    return s ? `/patients?${s}` : "/patients";
  };
  const chips: { key: string; label: string; soon?: boolean }[] = [
    ...(companies.length > 1 ? [{ key: "all", label: t("chipAll") }] : []),
    ...(companies.length > 1 ? companies.map((c) => ({ key: c.code, label: tc(c.code as "surgery") })) : []),
    { key: "surgery-30", label: t("chipSurgery"), soon: true },
    { key: "flagged", label: t("chipFlagged") },
  ];
  const chipClass = (on: boolean) =>
    `inline-flex h-9 items-center rounded-full px-3.5 text-[13.5px] ${on ? "border border-primary bg-primary font-semibold text-white" : "border border-line-strong bg-surface font-medium text-ink-2 hover:border-primary"}`;
  const fieldLabel = (m: string) => t(`match.${m}` as "match.name");

  return (
    <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-[22px] px-4 py-7 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[28px] font-semibold">{t("title")}</h1>
        {canEditPatients(actor.level) && (
          <Link href="/patients/new" className={primaryButton}><PlusIcon />{t("new")}</Link>
        )}
      </div>

      <SearchBox placeholder={contacts ? t("bigPlaceholder") : t("bigPlaceholderLimited")} label={t("searchLabel")} />

      <div role="group" aria-label={t("filters")} className="flex flex-wrap gap-2">
        {chips.map((c) =>
          c.soon ? (
            <span key={c.key} aria-disabled="true" title={t("soon")} className={`${chipClass(false)} opacity-45`}>{c.label}</span>
          ) : (
            <Link key={c.key} href={href({ f: c.key })} aria-pressed={activeChip === c.key} className={chipClass(activeChip === c.key)}>
              {c.label}
            </Link>
          ),
        )}
      </div>

      {result ? (
        <section className={`${card} overflow-hidden`}>
          <h2 className="border-b border-line-soft px-5 py-4 text-base font-semibold">{t("results", { count: result.total })}</h2>
          {result.rows.length === 0 && (
            <p className="px-5 py-7 text-[15px] text-muted">
              {t("noMatch")}{" "}
              {canEditPatients(actor.level) && <Link href="/patients/new" className="font-semibold text-primary hover:text-primary-hover">{t("createNew")}</Link>}
            </p>
          )}
          {result.rows.map((p) => {
            const age = ageToday(p.birthDate);
            const name = `${p.surname} ${p.firstName}`.trim();
            const details = contacts
              ? [p.phones?.[0]?.number, p.emails?.[0]?.email, p.amka && `${t("amka")} ${p.amka}`].filter(Boolean)
              : [];
            return (
              <Link key={p.id} href={`/patients/${p.id}`} className="flex flex-wrap items-center gap-3.5 border-b border-line-softer px-5 py-3.5 hover:bg-surface-2">
                <Avatar name={name} />
                <span className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-2 text-[15px] font-semibold">
                    {name}
                    <FlagDot flag={p.flag} label={t(`flag.${p.flag}`)} />
                    {p.infectiousDiseases && <span title={t("infectious")} className="text-xs text-danger">⚠</span>}
                    <span className="text-[13px] font-normal text-muted">
                      · {patientCode(p.number, p.company.code)}{age ? ` · ${t("years", { years: age.years })}` : ""}
                    </span>
                  </span>
                  {details.length > 0 && <span className="truncate text-[13px] text-ink-3">{details.join(" · ")}</span>}
                </span>
                {p.match && <Badge tone="info">{t("matched", { field: fieldLabel(p.match) })}</Badge>}
                {!companyId && companies.length > 1 && <Badge tone={p.company.code === "spa" ? "spa" : "primary"}>{tc(p.company.code as "surgery")}</Badge>}
                <span className="text-[13px] text-muted">{t("registered", { date: format.dateTime(p.registeredAt, { day: "2-digit", month: "2-digit", year: "2-digit" }) })}</span>
              </Link>
            );
          })}
          {result.pages > 1 && (
            <nav className="flex items-center justify-center gap-4 px-5 py-3 text-sm">
              {result.page > 1 ? <Link href={href({ page: result.page - 1 })} className="text-primary hover:underline">← {t("previous")}</Link> : <span />}
              <span className="text-muted">{t("page", { page: result.page, pages: result.pages })}</span>
              {result.page < result.pages ? <Link href={href({ page: result.page + 1 })} className="text-primary hover:underline">{t("next")} →</Link> : <span />}
            </nav>
          )}
        </section>
      ) : (
        <>
          <section className={`${card} overflow-hidden`}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft px-5 py-4">
              <h2 className="text-base font-semibold">{t("suggested")}</h2>
              <span className="text-[13px] text-muted">{t("suggestedHint")}</span>
            </div>
            <p className="px-5 py-6 text-sm text-muted">{t("suggestedSoon")}</p>
          </section>
          <section className={`${card} flex flex-col gap-2.5 px-5 py-4`}>
            <h2 className="text-base font-semibold">{t("recent")}</h2>
            {recent.length === 0 ? (
              <p className="text-sm text-muted">{t("recentNone")}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {recent.map((p) => (
                  <Link key={p.id} href={`/patients/${p.id}`} className="inline-flex h-[38px] items-center gap-2 rounded-full border border-line-strong bg-surface-2 px-3.5 text-sm font-medium hover:border-primary">
                    {p.surname} {p.firstName}
                    <span className="text-xs font-normal text-muted">{patientCode(p.number, p.company.code)}</span>
                    <FlagDot flag={p.flag} label={t(`flag.${p.flag}`)} />
                  </Link>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
