import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { CalendarIcon, ChatIcon, HomeIcon, LogoutIcon, PatientsIcon, ScalpelIcon, SearchIcon, SettingsIcon, TasksIcon } from "@/components/icons";
import { PatientSearch } from "@/components/patient-search";
import { NavLink } from "@/components/shell/nav-link";
import { Avatar } from "@/components/ui";
import { requireSession } from "@/lib/auth/current";
import { backupHealth } from "@/lib/backups";
import { activeCompany, userCompanies } from "@/lib/company";
import { canManageUsers, canSeeContactDetails } from "@/lib/permissions";
import { loadActor } from "@/lib/users/manage";
import { logoutAction, switchCompanyAction } from "./actions";

// App shell (DESIGN.md): left menu + top bar with patient search; bottom bar on phones.
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { user, expiresAt } = await requireSession();
  const actor = await loadActor(user.id);
  const [companies, current] = await Promise.all([userCompanies(actor.companyIds), activeCompany(actor)]);
  const t = await getTranslations();
  const format = await getFormatter();
  // Owners/Admins see a warning on every page if backups are not working.
  const backupProblem = canManageUsers(user.level) && !(await backupHealth()).ok;
  const soon = t("nav.soon");
  const settingsMatch = ["/settings", "/admin"];

  const companyLabel = (code: string) => (t.has(`companies.${code}`) ? t(`companies.${code}` as "companies.surgery") : code);

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col gap-5 overflow-y-auto border-r border-line bg-surface px-3.5 py-5 md:flex">
        <Link href="/" className="flex items-center gap-2.5 px-2">
          <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] bg-primary text-[15px] font-bold text-white">Π</span>
          <span className="flex flex-col">
            <span className="text-[15px] font-semibold">{t("app.brand")}</span>
            <span className="text-xs text-muted">{t("app.brandSub")}</span>
          </span>
        </Link>

        {companies.length > 1 && current ? (
          <form action={switchCompanyAction} role="group" aria-label={t("nav.company")} className="flex gap-[3px] rounded-[10px] bg-line-softer p-[3px]">
            {companies.map((c) => {
              const on = c.id === current.id;
              return (
                <button
                  key={c.id}
                  name="companyId"
                  value={c.id}
                  aria-pressed={on}
                  className={`flex-1 rounded-lg px-1.5 py-2 text-[13px] ${on ? "bg-surface font-semibold text-primary shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "font-medium text-muted hover:text-ink"}`}
                >
                  {companyLabel(c.code)}
                </button>
              );
            })}
          </form>
        ) : current ? (
          <p className="rounded-[10px] bg-line-softer px-3 py-2 text-center text-[13px] font-semibold text-primary">{companyLabel(current.code)}</p>
        ) : null}

        <nav aria-label={t("nav.main")} className="flex flex-col gap-0.5">
          <NavLink href="/" icon={<HomeIcon />} label={t("nav.office")} />
          <NavLink href="/patients" icon={<PatientsIcon />} label={t("nav.patients")} />
          <NavLink href="/calendar" icon={<CalendarIcon />} label={t("nav.calendar")} />
          <NavLink href="/surgeries" icon={<ScalpelIcon />} label={t("nav.surgeries")} soon={soon} />
          <NavLink href="/tasks" icon={<TasksIcon />} label={t("nav.tasks")} soon={soon} />
        </nav>

        <div className="mt-auto flex flex-col gap-0.5 border-t border-line-soft pt-3.5">
          <NavLink href="/settings" match={settingsMatch} icon={<SettingsIcon />} label={t("nav.settings")} />
          <div className="flex items-center gap-2.5 px-3 py-2.5">
            <Avatar name={user.name} size={30} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[13.5px] font-semibold">{user.name}</span>
              <span className="truncate text-xs text-muted">{t(`roles.${user.role}`)} · {t(`levels.${user.level}`)}</span>
            </span>
            <form action={logoutAction}>
              <button type="submit" title={t("nav.logout")} aria-label={t("nav.logout")} className="rounded-md p-1.5 text-muted hover:bg-line-softer hover:text-ink">
                <LogoutIcon />
              </button>
            </form>
          </div>
          <p className="px-3 text-[11.5px] text-muted">
            {t("nav.sessionEnds", {
              date: format.dateTime(expiresAt, { weekday: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
            })}
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-surface-2 px-4 py-3 md:px-8 md:py-[18px]">
          <Link href="/" aria-label={t("nav.office")} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-primary text-[15px] font-bold text-white md:hidden">Π</Link>
          <PatientSearch limited={!canSeeContactDetails(user.level)} />
          <Link href="/settings" aria-label={t("nav.settings")} className="md:hidden"><Avatar name={user.name} size={36} /></Link>
        </header>
        {backupProblem && (
          <div role="alert" className="bg-danger px-4 py-2 text-sm text-white md:px-8">
            {t("backups.banner")} <Link href="/admin/backups" className="underline">{t("backups.bannerLink")}</Link>
          </div>
        )}
        <div className="flex flex-1 flex-col pb-20 md:pb-0">{children}</div>
      </div>

      <nav aria-label={t("nav.main")} className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
        <NavLink variant="bottom" href="/" icon={<HomeIcon />} label={t("nav.today")} />
        <NavLink variant="bottom" href="/patients" icon={<SearchIcon size={19} />} label={t("nav.search")} />
        <NavLink variant="bottom" href="/chat" icon={<ChatIcon />} label={t("nav.chat")} soon={soon} />
        <NavLink variant="bottom" href="/calendar" icon={<CalendarIcon />} label={t("nav.calendar")} />
      </nav>
    </div>
  );
}
