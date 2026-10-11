import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Avatar, card, secondaryButton } from "@/components/ui";
import { requireSession } from "@/lib/auth/current";
import { activeCompany, userCompanies } from "@/lib/company";
import { canHandleMoney, canManageUsers } from "@/lib/permissions";
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

  const admin = [
    { href: "/admin/users", title: t("nav.users"), text: t("settings.usersText") },
    { href: "/admin/devices", title: t("nav.devices"), text: t("settings.devicesText") },
    { href: "/admin/audit", title: t("nav.audit"), text: t("settings.auditText") },
    { href: "/admin/backups", title: t("nav.backups"), text: t("settings.backupsText") },
    { href: "/settings/lists", title: t("settings.lists"), text: t("settings.listsText") },
  ];
  // Fees are money: the Secretary / PA-nurse set them, never the surgeon.
  const money = canHandleMoney(actor);

  return (
    <main className="mx-auto flex w-full max-w-[1240px] flex-col gap-5 px-4 py-6 md:px-8">
      <h1 className="text-[28px] font-semibold">{t("nav.settings")}</h1>

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

      {manager && (
        <section className="grid gap-4 sm:grid-cols-2">
          {admin.map((a) => (
            <Link key={a.href} href={a.href} className={`${card} flex flex-col gap-1 p-5 hover:border-primary`}>
              <span className="text-[17px] font-semibold text-primary">{a.title}</span>
              <span className="text-sm text-ink-3">{a.text}</span>
            </Link>
          ))}
        </section>
      )}
      {money && (
        <section className="grid gap-4 sm:grid-cols-2">
          <Link href="/settings/fees" className={`${card} flex flex-col gap-1 p-5 hover:border-primary`}>
            <span className="text-[17px] font-semibold text-primary">{t("settings.fees")}</span>
            <span className="text-sm text-ink-3">{t("settings.feesText")}</span>
          </Link>
        </section>
      )}
    </main>
  );
}
