import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/current";
import { backupHealth } from "@/lib/backups";
import { canManageUsers } from "@/lib/permissions";
import { logoutAction } from "./actions";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { user, expiresAt } = await requireSession();
  const t = await getTranslations();
  const format = await getFormatter();
  // Owners/Admins see a warning on every page if backups are not working.
  const backupProblem = canManageUsers(user.level) && !(await backupHealth()).ok;

  return (
    <>
      <header className="flex items-center justify-between gap-4 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <nav className="flex items-center gap-4">
          <Link href="/" className="font-semibold">{t("app.name")}</Link>
          <Link href="/patients" className="text-sm hover:underline">{t("nav.patients")}</Link>
          {canManageUsers(user.level) && (
            <>
              <Link href="/admin/users" className="text-sm hover:underline">{t("nav.users")}</Link>
              <Link href="/admin/devices" className="text-sm hover:underline">{t("nav.devices")}</Link>
              <Link href="/admin/audit" className="text-sm hover:underline">{t("nav.audit")}</Link>
              <Link href="/admin/backups" className="text-sm hover:underline">{t("nav.backups")}</Link>
            </>
          )}
        </nav>
        <div className="flex items-center gap-4 text-sm">
          <span className="hidden text-neutral-500 sm:inline">
            {t("nav.sessionEnds", {
              date: format.dateTime(expiresAt, { weekday: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
            })}
          </span>
          <span>
            {user.name} · <span className="text-neutral-500">{t(`levels.${user.level}`)}</span>
          </span>
          <form action={logoutAction}>
            <button type="submit" className="rounded-md border border-neutral-300 px-3 py-1 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800">
              {t("nav.logout")}
            </button>
          </form>
        </div>
      </header>
      {backupProblem && (
        <div role="alert" className="bg-red-700 px-4 py-2 text-sm text-white">
          {t("backups.banner")} <Link href="/admin/backups" className="underline">{t("backups.bannerLink")}</Link>
        </div>
      )}
      {children}
    </>
  );
}
