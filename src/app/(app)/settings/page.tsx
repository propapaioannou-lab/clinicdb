import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Avatar, card, secondaryButton } from "@/components/ui";
import { requireSession } from "@/lib/auth/current";
import { activeCompany, userCompanies } from "@/lib/company";
import { canEditPatients, canHandleMoney, canManageUsers } from "@/lib/permissions";
import { loadActor } from "@/lib/users/manage";
import { logoutAction, switchCompanyAction } from "../actions";

// Ρυθμίσεις: everything that is not daily work lives here, so the menu stays short.
export default async function SettingsPage() {
  const { user, expiresAt } = await requireSession();
  const actor = await loadActor(user.id);
  const [companies, current] = await Promise.all([userCompanies(actor.companyIds), activeCompany(actor)]);
  const t = await getTranslations();
  const format = await getFormatter();
  const manager = canManageUsers(user.level);

  // Grouped (decided 12 Oct 2026): account · security & access · customization · money.
  // Every page inside has "← Ρυθμίσεις" to come back here.
  type Item = { href: string; title: string; text: string };
  const groups: { key: string; items: Item[] }[] = [
    {
      key: "security",
      items: manager
        ? [
            { href: "/admin/users", title: t("nav.users"), text: t("settings.usersText") },
            { href: "/admin/devices", title: t("nav.devices"), text: t("settings.devicesText") },
            { href: "/admin/audit", title: t("nav.audit"), text: t("settings.auditText") },
            { href: "/admin/backups", title: t("nav.backups"), text: t("settings.backupsText") },
          ]
        : [],
    },
    {
      key: "customization",
      items: [
        // Calendar: blocked time for every staff member; types/lengths/hours inside for Owner/Admin.
        ...(canEditPatients(user.level) ? [{ href: "/settings/calendar", title: t("settings.calendar"), text: t("settings.calendarText") }] : []),
        ...(manager
          ? [
              { href: "/settings/lists", title: t("settings.lists"), text: t("settings.listsText") },
              { href: "/settings/history", title: t("settings.history"), text: t("settings.historyText") },
              { href: "/settings/procedures", title: t("settings.procedures"), text: t("settings.proceduresText") },
            ]
          : []),
      ],
    },
    // Fees are money: the Secretary / PA-nurse set them, never the surgeon.
    { key: "money", items: canHandleMoney(actor) ? [{ href: "/settings/fees", title: t("settings.fees"), text: t("settings.feesText") }] : [] },
  ];

  return (
    <main className="mx-auto flex w-full max-w-[1240px] flex-col gap-5 px-4 py-6 md:px-8">
      <h1 className="text-[28px] font-semibold">{t("nav.settings")}</h1>
      <h2 className="-mb-2 text-[13px] font-semibold uppercase tracking-wide text-muted">{t("settings.groups.account")}</h2>

      <section className={`${card} flex flex-wrap items-center gap-4 p-5`}>
        <Avatar name={user.name} size={52} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[17px] font-semibold">{user.name}</span>
          <span className="text-sm text-muted">{user.email} · {t(`roles.${user.role}`)} · {t(`levels.${user.level}`)}</span>
          <span className="text-sm text-muted">
            {t("nav.sessionEnds", { date: format.dateTime(expiresAt, { weekday: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }) })}
          </span>
        </div>
        <form action={logoutAction}>
          <button type="submit" className={secondaryButton}>{t("nav.logout")}</button>
        </form>
      </section>

      {companies.length > 1 && current && (
        <section className={`${card} p-5 md:hidden`}>
          <h2 className="mb-3 text-[17px] font-semibold">{t("nav.company")}</h2>
          <form action={switchCompanyAction} className="flex gap-[3px] rounded-[10px] bg-line-softer p-[3px]">
            {companies.map((c) => (
              <button
                key={c.id}
                name="companyId"
                value={c.id}
                aria-pressed={c.id === current.id}
                className={`h-11 flex-1 rounded-lg text-sm ${c.id === current.id ? "bg-surface font-semibold text-primary" : "font-medium text-muted"}`}
              >
                {t(`companies.${c.code}` as "companies.surgery")}
              </button>
            ))}
          </form>
        </section>
      )}

      {groups.filter((g) => g.items.length).map((g) => (
        <section key={g.key} className="flex flex-col gap-3">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted">{t(`settings.groups.${g.key}` as "settings.groups.security")}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {g.items.map((a) => (
              <Link key={a.href} href={a.href} className={`${card} flex flex-col gap-1 p-5 hover:border-primary`}>
                <span className="text-[17px] font-semibold text-primary">{a.title}</span>
                <span className="text-sm text-ink-3">{a.text}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
