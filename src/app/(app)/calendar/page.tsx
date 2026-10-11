import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { primaryButton } from "@/components/ui";
import { requireSession } from "@/lib/auth/current";
import { calendarDay } from "@/lib/calendar/day";
import { activeCompany } from "@/lib/company";
import { db } from "@/lib/db";
import { canEditPatients } from "@/lib/permissions";
import { athensIsoDate } from "@/lib/time";
import { loadActor } from "@/lib/users/manage";
import { DayView } from "./day-view";

const shift = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

// Ημερολόγιο (Phase 6a-2): the secretary day view of the company in the Ιατρείο | Spa
// switch. Week, month and the physician's views come in 6a-3.
export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const session = await requireSession();
  const actor = await loadActor(session.user.id);
  if (!canEditPatients(actor.level)) notFound();
  const company = await activeCompany(actor);
  if (!company) notFound();
  const t = await getTranslations("calendar");
  const sp = await searchParams;
  const today = athensIsoDate(new Date());
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const [data, types] = await Promise.all([
    calendarDay(actor, company.id, date),
    db.appointmentType.findMany({ where: { companyId: company.id, isActive: true, NOT: { layer: "SURGERY" } }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
  ]);
  if (!data) notFound();
  const title = new Intl.DateTimeFormat("el-GR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
  const nav = "flex h-11 min-w-11 items-center justify-center rounded-control border border-line-strong bg-surface px-3 text-sm font-semibold hover:border-primary";
  return (
    <main className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 px-4 py-5 md:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/calendar?date=${shift(date, -1)}`} aria-label={t("prev")} className={nav}>‹</Link>
          <Link href="/calendar" className={nav}>{t("today")}</Link>
          <Link href={`/calendar?date=${shift(date, 1)}`} aria-label={t("next")} className={nav}>›</Link>
          <div className="ml-2 flex flex-col">
            <h1 className="text-[24px] font-semibold first-letter:uppercase">{title}</h1>
            <span className="text-[13px] text-muted">{t("subtitle")}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-[12px] bg-line-softer p-1 text-sm">
            <span className="rounded-[9px] bg-surface px-4 py-2 font-semibold text-primary shadow-[0_1px_2px_rgba(0,0,0,0.08)]">{t("views.day")}</span>
            <span title={t("soon")} className="px-4 py-2 text-muted opacity-60">{t("views.week")}</span>
            <span title={t("soon")} className="px-4 py-2 text-muted opacity-60">{t("views.month")}</span>
          </div>
          <span title={t("surgerySoon")} className="flex h-11 items-center rounded-control bg-cal-blue/50 px-4 text-sm font-semibold text-white">+ {t("surgery")}</span>
          <Link href={`/calendar?date=${date}&book=1`} className={primaryButton}>+ {t("appointment")}</Link>
        </div>
      </div>
      <DayView key={`${date}${sp.book ?? ""}`} startBooking={sp.book === "1"} data={data} types={types.map((ty) => ({ id: ty.id, label: ty.labelEl, minutes: ty.defaultMinutes, color: ty.color }))} todayIso={today} />
    </main>
  );
}
