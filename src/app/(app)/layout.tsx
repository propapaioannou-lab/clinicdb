import Link from "next/link";
import { cookies } from "next/headers";
import { getFormatter, getTranslations } from "next-intl/server";
import { CalendarIcon, ChatIcon, HomeIcon, LogoutIcon, PatientsIcon, ScalpelIcon, SearchIcon, SettingsIcon, TasksIcon } from "@/components/icons";
import { PatientSearch } from "@/components/patient-search";
import { NavLink } from "@/components/shell/nav-link";
import { RailToggle } from "@/components/shell/rail-toggle";
import { TopBar } from "@/components/shell/top-bar";
import { Avatar } from "@/components/ui";
import { requireSession } from "@/lib/auth/current";
import { backupHealth } from "@/lib/backups";
import { activeCompany, userCompanies } from "@/lib/company";
import { canManageUsers, canSeeContactDetails } from "@/lib/permissions";
import { loadActor } from "@/lib/users/manage";
import { ReadyBanner } from "@/components/live/ready-banner";
import { SuggestButton } from "@/components/demo/suggest-button";
import { isDemo } from "@/lib/demo";
import { surgeonResources } from "@/lib/calendar/views";
import { logoutAction, switchCompanyAction } from "./actions";

// App shell (DESIGN.md): left menu + top bar with patient search; bottom bar on phones.
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { user, expiresAt } = await requireSession();
  const actor = await loadActor(user.id);
  const [companies, current] = await Promise.all([userCompanies(actor.companyIds), activeCompany(actor)]);
  const t = await getTranslations();
  const format = await getFormatter();
  // Owners/Admins see a warning on every page if backups are not working.
  // (The online demo has no backups of its own: no warning there.)
  const backupProblem = canManageUsers(user.level) && !isDemo() && !(await backupHealth()).ok;
  // Surgeons get the "ready in room" banner for their own column(s) on every page.
  const readyFor = actor.role === "SURGEON" && current ? await surgeonResources(actor.id, current.id) : [];
  const soon = t("nav.soon");
  const settingsMatch = ["/settings", "/admin"];

  const rail = (await cookies()).get("clinic_rail")?.value === "1";
  const companyLabel = (code: string) => (t.has(`companies.${code}`) ? t(`companies.${code}` as "companies.surgery") : code);

  return (
    <div className="flex min-h-screen">
      <aside id="side-menu" data-rail={rail} className="side sticky top-0 hidden h-screen shrink-0 flex-col gap-5 overflow-y-auto overflow-x-hidden border-r border-line bg-surface px-3.5 py-5 transition-[width] md:flex">
        <Link href="/" className="flex items-center gap-2.5 px-2" title={t("app.brand")}>
          <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] bg-primary text-[15px] font-bold text-white">Π</span>
          <span className="rail-hide flex flex-col">
            <span className="text-[15px] font-semibold">{t("app.brand")}</span>
            <span className="text-xs text-muted">{t("app.brandSub")}</span>
          </span>
        </Link>

        {companies.length > 1 && current ? (
          <form action={switchCompanyAction} role="group" aria-label={t("nav.company")} className="rail-col flex gap-[3px] rounded-[10px] bg-line-softer p-[3px]">
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
                  <span className="rail-hide">{companyLabel(c.code)}</span>
                  <span className="rail-only justify-center" title={companyLabel(c.code)}>{companyLabel(c.code).slice(0, 1)}</span>
                </button>
              );
            })}
          </form>
        ) : current ? (
          <p className="rounded-[10px] bg-line-softer px-3 py-2 text-center text-[13px] font-semibold text-primary" title={companyLabel(current.code)}><span className="rail-hide">{companyLabel(current.code)}</span><span className="rail-only justify-center">{companyLabel(current.code).slice(0, 1)}</span></p>
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
          <div className="flex flex-wrap items-center gap-2.5 px-1.5 py-2.5">
            <span title={user.name}><Avatar name={user.name} size={30} /></span>
            <span className="rail-hide flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[13.5px] font-semibold">{user.name}</span>
              <span className="truncate text-xs text-muted">{t(`roles.${user.role}`)} · {t(`levels.${user.level}`)}</span>
            </span>
            <form action={logoutAction}>
              <button type="submit" title={t("nav.logout")} aria-label={t("nav.logout")} className="rounded-md p-1.5 text-muted hover:bg-line-softer hover:text-ink">
                <LogoutIcon />
              </button>
            </form>
          </div>
          <p className="rail-hide px-3 text-[11.5px] text-muted">
            {t("nav.sessionEnds", {
              date: format.dateTime(expiresAt, { weekday: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
            })}
          </p>
          <RailToggle initial={rail} labels={{ open: t("nav.railOpen"), close: t("nav.railClose") }} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar>
          <Link href="/" aria-label={t("nav.office")} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-primary text-[15px] font-bold text-white md:hidden">Π</Link>
          <PatientSearch limited={!canSeeContactDetails(user.level)} />
          <Link href="/settings" aria-label={t("nav.settings")} className="md:hidden"><Avatar name={user.name} size={36} /></Link>
        </TopBar>
        {backupProblem && (
          <div role="alert" className="bg-danger px-4 py-2 text-sm text-white md:px-8">
            {t("backups.banner")} <Link href="/admin/backups" className="underline">{t("backups.bannerLink")}</Link>
          </div>
        )}
        <div className="flex flex-1 flex-col pb-20 md:pb-0">
          {readyFor.length > 0 && current && <ReadyBanner companyId={current.id} resourceIds={readyFor} />}
          {children}
        </div>
      </div>

      {isDemo() && <SuggestButton />}
      <nav aria-label={t("nav.main")} className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
        <NavLink variant="bottom" href="/" icon={<HomeIcon />} label={t("nav.today")} />
        <NavLink variant="bottom" href="/patients" icon={<SearchIcon size={19} />} label={t("nav.search")} />
        <NavLink variant="bottom" href="/chat" icon={<ChatIcon />} label={t("nav.chat")} />
        <NavLink variant="bottom" href="/calendar" icon={<CalendarIcon />} label={t("nav.calendar")} />
      </nav>
    </div>
  );
}
