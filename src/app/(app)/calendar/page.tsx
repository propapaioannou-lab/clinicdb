import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { primaryButton } from "@/components/ui";
import { requireSession } from "@/lib/auth/current";
import { freeSlots } from "@/lib/calendar/appointments";
import { calendarDay } from "@/lib/calendar/day";
import { addDays, calendarRange, mondayOf, ownResource, patientCard } from "@/lib/calendar/views";
import { activeCompany } from "@/lib/company";
import { db } from "@/lib/db";
import { canEditPatients } from "@/lib/permissions";
import { athensIsoDate, athensParts } from "@/lib/time";
import { loadActor } from "@/lib/users/manage";
import { DayView } from "./day-view";
import { DeskMonth, DeskWeek } from "./desk-views";
import { DoctorDay, DoctorMonth, DoctorWeek } from "./doctor-views";

type View = "day" | "week" | "month";
const VIEWS: View[] = ["day", "week", "month"];
const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("el-GR", { ...o, timeZone: "UTC" });
const at = (iso: string) => new Date(`${iso}T12:00:00Z`);
const minutesSince = (d: Date) => Math.max(0, Math.round((Date.now() - d.getTime()) / 60e3));
const daysUntil = (d: Date) => Math.floor((d.getTime() - Date.now()) / 864e5);

// Ημερολόγιο (Phase 6a): each person sees what they act on (DESIGN 6a–6f). A surgeon gets
// their own day / week / month (no money, no booking buttons); everyone else the front
// desk's. The Owner-surgeon can open the front-desk view with ?as=desk.
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
  const view: View = VIEWS.includes(sp.view as View) ? (sp.view as View) : "day";
  const doctor = actor.role === "SURGEON" && sp.as !== "desk";
  const own = doctor ? await ownResource(actor, company.id) : null;
  const q = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const all = { view, date, as: doctor || sp.as !== "desk" ? undefined : "desk", nurse: sp.nurse as string | undefined, ...over };
    for (const [k, v] of Object.entries(all)) if (v && !(k === "view" && v === "day")) p.set(k, v);
    return `/calendar${p.size ? `?${p}` : ""}`;
  };
  const step = view === "day" ? 1 : view === "week" ? 7 : 0;
  const shiftMonth = (n: number) => {
    const d = at(date);
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + n);
    return d.toISOString().slice(0, 10);
  };
  const prev = step ? addDays(date, -step) : shiftMonth(-1);
  const next = step ? addDays(date, step) : shiftMonth(1);
  const monday = mondayOf(date);
  const title =
    view === "day" ? fmt({ weekday: "long", day: "numeric", month: "long" }).format(at(date))
    : view === "week" ? `${Number(monday.slice(8))} – ${fmt({ day: "numeric", month: "long" }).format(at(addDays(monday, 5)))}`
    : fmt({ month: "long", year: "numeric" }).format(at(date));

  // Columns: the surgeon's own; the front desk's doctor (+ nurse on demand in week).
  const resources = await db.resource.findMany({ where: { companyId: company.id, isActive: true, NOT: { kind: "OPERATING_ROOM" } }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  const doctorCol = resources.find((r) => r.kind === "DOCTOR" || r.kind === "CABIN") ?? resources[0];
  let body: React.ReactNode = null;
  if (view === "day" && !doctor) {
    const [data, types] = await Promise.all([
      calendarDay(actor, company.id, date),
      db.appointmentType.findMany({ where: { companyId: company.id, isActive: true, NOT: { layer: "SURGERY" } }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    ]);
    if (!data) notFound();
    body = <DayView key={`${date}${sp.book ?? ""}`} startBooking={sp.book === "1"} data={data} types={types.map((ty) => ({ id: ty.id, label: ty.labelEl, minutes: ty.defaultMinutes, color: ty.color }))} todayIso={today} />;
  } else if (view === "day" && own) {
    const [days, tomorrow] = await Promise.all([calendarRange(actor, company.id, date, 1, [own.id]), calendarRange(actor, company.id, addDays(date, 1), 1, [own.id])]);
    const day = days![0];
    const nowMin = date === today ? (() => { const p = athensParts(new Date()); return p.hour * 60 + p.minute; })() : null;
    const mine = day.appointments.filter((a) => a.resourceId === own.id && a.active);
    const current = mine.find((a) => a.status === "WITH_DOCTOR") ?? null;
    const upcoming = mine.find((a) => a.id !== current?.id && !["DONE", "TO_PAY", "WITH_DOCTOR"].includes(a.status) && (nowMin === null || date > today || a.end > nowMin));
    let nextCard = null;
    if (upcoming && date >= today) {
      const arrival = upcoming.status === "ARRIVED" || upcoming.status === "READY"
        ? await db.appointmentEvent.findFirst({ where: { appointmentId: upcoming.id, toStatus: "ARRIVED" }, orderBy: { at: "desc" } })
        : null;
      nextCard = {
        a: upcoming,
        patient: upcoming.patientId ? await patientCard(company.id, upcoming.patientId) : null,
        waiting: arrival ? minutesSince(arrival.at) : null,
      };
    }
    body = <DoctorDay day={day} resourceId={own.id} now={nowMin} next={nextCard} current={current} tomorrowCount={tomorrow![0].appointments.filter((a) => a.active).length} />;
  } else if (view === "week") {
    const cols = doctor ? (own ? [own] : []) : [doctorCol, ...(sp.nurse === "1" ? resources.filter((r) => r.kind === "NURSE") : [])].filter(Boolean);
    const days = (await calendarRange(actor, company.id, monday, 6, cols.map((c) => c!.id)))!;
    body = doctor && own ? <DoctorWeek days={days} resourceId={own.id} todayIso={today} /> : <DeskWeek days={days} resources={cols.map((c) => ({ id: c!.id, label: c!.label }))} todayIso={today} />;
  } else if (view === "month") {
    const first = `${date.slice(0, 7)}-01`;
    const gridStart = mondayOf(first);
    const last = addDays(shiftMonth(1).slice(0, 8) + "01", -1);
    const gridDays = Math.ceil((Number(new Date(`${last}T12:00:00Z`)) - Number(new Date(`${gridStart}T12:00:00Z`))) / 864e5 / 7 + 1 / 7) * 7;
    const col = doctor ? own : doctorCol;
    const days = col ? (await calendarRange(actor, company.id, gridStart, gridDays, [col.id]))! : [];
    if (doctor && own) body = <DoctorMonth days={days} resourceId={own.id} monthIso={first} todayIso={today} />;
    else {
      // New-patient slots: the first free 30′ for the doctor; banner if more than 10 days away.
      const firstType = await db.appointmentType.findFirst({ where: { companyId: company.id, isActive: true, layer: "OFFICE" }, orderBy: { sortOrder: "asc" } });
      const slot = col ? (await freeSlots(company.id, col.id, new Date(), firstType?.defaultMinutes ?? 30, { days: 90, limit: 1 }))[0] : undefined;
      const firstFree = slot
        ? { days: daysUntil(slot), label: new Intl.DateTimeFormat("el-GR", { timeZone: "Europe/Athens", weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(slot) }
        : null;
      body = <DeskMonth days={days} monthIso={first} todayIso={today} firstFree={firstFree} />;
    }
  }

  const nav = "flex h-11 min-w-11 items-center justify-center rounded-control border border-line-strong bg-surface px-3 text-sm font-semibold hover:border-primary";
  return (
    <main className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 px-4 py-5 md:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={q({ date: prev })} aria-label={t("prev")} className={nav}>‹</Link>
          <Link href={q({ date: undefined })} className={nav}>{t("today")}</Link>
          <Link href={q({ date: next })} aria-label={t("next")} className={nav}>›</Link>
          <div className="ml-2 flex flex-col">
            <h1 className="text-[24px] font-semibold first-letter:uppercase">{title}</h1>
            <span className="text-[13px] text-muted">{doctor ? t(`subtitleDoctor.${view}`) : t(`subtitleDesk.${view}`)}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <nav aria-label={t("viewLabel")} className="flex rounded-[12px] bg-line-softer p-1 text-sm">
            {VIEWS.map((v) => (
              <Link key={v} href={q({ view: v })} aria-current={v === view ? "page" : undefined}
                className={`rounded-[9px] px-4 py-2 ${v === view ? "bg-surface font-semibold text-primary shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "text-ink-3 hover:text-ink"}`}>
                {t(`views.${v}`)}
              </Link>
            ))}
          </nav>
          {!doctor && (
            <>
              <span title={t("surgerySoon")} className="flex h-11 items-center rounded-control bg-cal-blue/50 px-4 text-sm font-semibold text-white">+ {t("surgery")}</span>
              <Link href={q({ view: undefined, book: "1" })} className={primaryButton}>+ {t("appointment")}</Link>
            </>
          )}
        </div>
      </div>
      {!doctor && view === "week" && resources.some((r) => r.kind === "NURSE") && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
          {t("show")}:
          <span className="rounded-full border border-primary bg-primary-tint px-3 py-1 font-semibold text-primary">{doctorCol?.label}</span>
          <Link href={q({ nurse: sp.nurse === "1" ? undefined : "1" })} className={`rounded-full border px-3 py-1 ${sp.nurse === "1" ? "border-primary bg-primary-tint font-semibold text-primary" : "border-line-strong"}`}>
            {sp.nurse === "1" ? "✓" : "+"} {resources.find((r) => r.kind === "NURSE")?.label}
          </Link>
        </div>
      )}
      {doctor && !own && <p className="text-sm text-muted">{t("noOwnColumn")}</p>}
      {body}
      {actor.role === "SURGEON" && (
        <Link href={doctor ? `/calendar?as=desk${view !== "day" ? `&view=${view}` : ""}&date=${date}` : `/calendar${view !== "day" ? `?view=${view}&date=${date}` : `?date=${date}`}`} className="self-start text-[13px] font-semibold text-muted hover:text-primary">
          {doctor ? t("deskView") : t("myView")} →
        </Link>
      )}
    </main>
  );
}
