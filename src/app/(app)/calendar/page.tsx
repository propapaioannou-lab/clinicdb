import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { LiveRefresh } from "@/components/live/live-refresh";
import { primaryButton } from "@/components/ui";
import { requireSession } from "@/lib/auth/current";
import { freeSlots } from "@/lib/calendar/appointments";
import { CALENDAR_KINDS, calendarDay } from "@/lib/calendar/day";
import { confirmations } from "@/lib/calendar/strip";
import { addDays, calendarRange, mondayOf, ownResource, patientCard, rangeScale } from "@/lib/calendar/views";
import { activeCompany } from "@/lib/company";
import { db } from "@/lib/db";
import { canEditPatients } from "@/lib/permissions";
import { athensIsoDate, athensParts } from "@/lib/time";
import { loadActor } from "@/lib/users/manage";
import { DayView } from "./day-view";
import { DeskMonth, DeskWeek } from "./desk-views";
import { DoctorDay, DoctorMonth, DoctorWeek, doctorTiles } from "./doctor-views";
import { CarryBar, MoveToast } from "./move-toast";
import { TopStrip, type Tile } from "./top-strip";

type View = "day" | "week" | "month";
const VIEWS: View[] = ["day", "week", "month"];
const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("el-GR", { ...o, timeZone: "UTC" });
const at = (iso: string) => new Date(`${iso}T12:00:00Z`);
const minutesSince = (d: Date) => Math.max(0, Math.round((Date.now() - d.getTime()) / 60e3));
const daysUntil = (d: Date) => Math.floor((d.getTime() - Date.now()) / 864e5);
const isWeekend = (iso: string) => [0, 6].includes(at(iso).getUTCDay());
// Day by day, skipping Sat/Sun unless they are shown.
const stepDay = (iso: string, dir: 1 | -1, weekend: boolean) => {
  let d = addDays(iso, dir);
  while (!weekend && isWeekend(d)) d = addDays(d, dir);
  return d;
};

// Ημερολόγιο (Phase 6a, calendar v2 — DESIGN 6a–6g): each person sees what they act on.
// A surgeon gets their own day / week / month (no money, no booking buttons); everyone
// else the front desk's. The Owner-surgeon can open the front-desk view with ?as=desk.
// One-line header, a top strip of tiles, then the calendar at full width; Mon–Fri with
// «+ Σαβ/Κυρ» (?we=1).
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
  const weekend = sp.we === "1";
  const doctor = actor.role === "SURGEON" && sp.as !== "desk";
  const own = doctor ? await ownResource(actor, company.id) : null;
  // «Μετακίνηση» (6a-7): the appointment being carried to a new time (?carry=id), kept
  // while moving between days, weeks and months.
  const carried = typeof sp.carry === "string" && !doctor
    ? await db.appointment.findFirst({
        where: { id: sp.carry, companyId: company.id, status: { in: ["BOOKED", "CONFIRMED", "ARRIVED", "READY", "WITH_DOCTOR", "TO_PAY"] }, type: { layer: { not: "SURGERY" } } },
        include: { patient: { select: { firstName: true, surname: true } }, type: { select: { labelEl: true } } },
      })
    : null;
  const carry = carried
    ? {
        id: carried.id,
        minutes: Math.round((carried.endsAt.getTime() - carried.startsAt.getTime()) / 60e3),
        label: `${carried.patient ? `${carried.patient.firstName} ${carried.patient.surname.slice(0, 1)}.` : carried.type.labelEl} · ${carried.type.labelEl}`,
        name: carried.patient ? `${carried.patient.firstName} ${carried.patient.surname}`.trim() : carried.type.labelEl,
        from: new Intl.DateTimeFormat("el-GR", { timeZone: "Europe/Athens", weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(carried.startsAt),
      }
    : null;
  const q = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const all = { view, date, as: doctor || sp.as !== "desk" ? undefined : "desk", we: weekend ? "1" : undefined, carry: carry?.id, ...over };
    for (const [k, v] of Object.entries(all)) if (v && !(k === "view" && v === "day")) p.set(k, v);
    return `/calendar${p.size ? `?${p}` : ""}`;
  };
  const shiftMonth = (n: number) => {
    const d = at(date);
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + n);
    return d.toISOString().slice(0, 10);
  };
  const prev = view === "day" ? stepDay(date, -1, weekend) : view === "week" ? addDays(date, -7) : shiftMonth(-1);
  const next = view === "day" ? stepDay(date, 1, weekend) : view === "week" ? addDays(date, 7) : shiftMonth(1);
  const monday = mondayOf(date);
  const weekDays = weekend ? 7 : 5;
  const title =
    view === "day" ? fmt({ weekday: "long", day: "numeric", month: "long" }).format(at(date))
    : view === "week" ? `${Number(monday.slice(8))} – ${fmt({ day: "numeric", month: "long" }).format(at(addDays(monday, weekDays - 1)))}`
    : fmt({ month: "long", year: "numeric" }).format(at(date));

  // Columns: the surgeon's own; the front desk's doctor(s) (Spa: its cabins). No nurse
  // calendar (removed 12 Oct 2026); treatment rooms are where patients wait, not columns.
  const resources = await db.resource.findMany({ where: { companyId: company.id, isActive: true, kind: { in: CALENDAR_KINDS } }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  const doctorCol = resources.find((r) => r.kind === "DOCTOR" || r.kind === "CABIN") ?? resources[0];
  // For the colour key under the grid.
  const officeTypes = (await db.appointmentType.findMany({ where: { companyId: company.id, isActive: true, NOT: { layer: "SURGERY" } }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }))
    .map((ty) => ({ id: ty.id, label: ty.labelEl, minutes: ty.defaultMinutes, color: ty.color, forNewPatients: ty.forNewPatients }));
  // «+ Ραντεβού» = the next free slot of the doctor's column (normal hours, shortest type),
  // from the day shown (or now). ?book=next (from the home page) goes straight there.
  let nextFree: string | null = null;
  if (!doctor && doctorCol) {
    const from = date > today ? new Date(`${date}T00:00:00Z`) : new Date();
    const shortest = Math.min(30, ...officeTypes.map((x) => x.minutes));
    const slot = (await freeSlots(company.id, doctorCol.id, from, shortest, { days: 60, limit: 1, step: 5 }))[0];
    if (slot) {
      const p = athensParts(slot);
      nextFree = `/calendar?${new URLSearchParams({ date: athensIsoDate(slot), book: `${doctorCol.id}.${p.hour * 60 + p.minute}`, ...(weekend && { we: "1" }) })}`;
    }
  }
  if (sp.book === "next" && nextFree) redirect(nextFree);
  let body: React.ReactNode = null;
  let tiles: Tile[] = [];
  if (view === "day" && !doctor) {
    const data = await calendarDay(actor, company.id, date);
    if (!data) notFound();
    // «+ Ραντεβού» opens the quick-booking panel on the next free slot (?book=resource.minute).
    const m = typeof sp.book === "string" ? /^([\w-]+)\.(\d{1,4})$/.exec(sp.book) : null;
    const startAt = m && data.columns.some((c) => c.id === m[1]) ? { resourceId: m[1], start: Number(m[2]) } : undefined;
    body = <DayView key={`${date}${sp.book ?? ""}`} startAt={carry ? undefined : startAt} data={data} types={officeTypes} carry={carry} />;
  } else if (view === "day" && own) {
    const [days, tomorrow] = await Promise.all([calendarRange(actor, company.id, date, 1, [own.id]), calendarRange(actor, company.id, stepDay(date, 1, false), 1, [own.id])]);
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
    // Same layout every day: the scale comes from the whole week of this column.
    const week = (await calendarRange(actor, company.id, monday, 7, [own.id]))!;
    tiles = await doctorTiles({ day, resourceId: own.id, next: nextCard, current, tomorrow: tomorrow![0].appointments.filter((a) => a.active && a.resourceId === own.id) });
    body = <DoctorDay day={day} resourceId={own.id} current={current} scale={rangeScale([...week, day], [own.id])} types={officeTypes} />;
  } else if (view === "week") {
    const cols = doctor ? (own ? [own] : []) : [doctorCol].filter(Boolean);
    const ids = cols.map((c) => c!.id);
    const days = (await calendarRange(actor, company.id, monday, weekDays, ids))!;
    body = doctor && own ? <DoctorWeek days={days} resourceId={own.id} todayIso={today} /> : <DeskWeek days={days} resources={cols.map((c) => ({ id: c!.id, label: c!.label }))} todayIso={today} scale={rangeScale(days, ids)} types={officeTypes} carry={carry} />;
  } else if (view === "month") {
    const first = `${date.slice(0, 7)}-01`;
    const gridStart = mondayOf(first);
    const last = addDays(shiftMonth(1).slice(0, 8) + "01", -1);
    const gridDays = Math.ceil((Number(new Date(`${last}T12:00:00Z`)) - Number(new Date(`${gridStart}T12:00:00Z`))) / 864e5 / 7 + 1 / 7) * 7;
    const col = doctor ? own : doctorCol;
    const days = col ? (await calendarRange(actor, company.id, gridStart, gridDays, [col.id]))! : [];
    if (doctor && own) body = <DoctorMonth days={days} resourceId={own.id} monthIso={first} todayIso={today} weekend={weekend} />;
    else {
      // New-patient slots: the first free 30′ for the doctor; banner if more than 10 days away.
      const firstType = await db.appointmentType.findFirst({ where: { companyId: company.id, isActive: true, layer: "OFFICE" }, orderBy: { sortOrder: "asc" } });
      const slot = col ? (await freeSlots(company.id, col.id, new Date(), firstType?.defaultMinutes ?? 30, { days: 90, limit: 1 }))[0] : undefined;
      const firstFree = slot
        ? { days: daysUntil(slot), label: new Intl.DateTimeFormat("el-GR", { timeZone: "Europe/Athens", weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(slot) }
        : null;
      body = <DeskMonth days={days} monthIso={first} todayIso={today} firstFree={firstFree} weekend={weekend} carry={carry?.id} />;
    }
  }
  if (!doctor) tiles = await deskTiles(actor, company.id, today);
  const nav = "flex h-10 min-w-10 items-center justify-center rounded-control border border-line-strong bg-surface px-2.5 text-sm font-semibold hover:border-primary";
  const seg = (on: boolean) => `whitespace-nowrap rounded-[9px] px-2.5 py-1.5 text-[13px] ${on ? "bg-surface font-semibold text-primary shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "text-ink-3 hover:text-ink"}`;
  return (
    <main className="flex w-full flex-col gap-3 px-4 py-4 md:px-6">
      <LiveRefresh companyId={company.id} />
      {/* One-line header (DESIGN 6a–6g): ‹ Σήμερα › · title · views · Δευ–Παρ · actions. */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Link href={q({ date: prev })} aria-label={t("prev")} className={nav}>‹</Link>
        <Link href={q({ date: undefined })} className={nav}>{t("today")}</Link>
        <Link href={q({ date: next })} aria-label={t("next")} className={nav}>›</Link>
        <h1 className="mx-1 flex items-baseline gap-2 whitespace-nowrap">
          <span className="text-[20px] font-semibold first-letter:uppercase">{title}</span>
          <span className="hidden text-[13px] font-normal text-muted 2xl:inline">{doctor ? t(`subtitleDoctor.${view}`) : t(`subtitleDesk.${view}`)}</span>
        </h1>
        {/* Surgeons switch between their own schedule and the front desk's. */}
        {actor.role === "SURGEON" && (
          <nav aria-label={t("whoseView")} className="flex gap-[3px] rounded-[12px] bg-line-softer p-1">
            {([["doctor", false], ["desk", true]] as const).map(([k, desk]) => {
              const on = desk !== doctor;
              const href = `/calendar?${new URLSearchParams({ ...(view !== "day" && { view }), date, ...(desk && { as: "desk" }), ...(weekend && { we: "1" }) })}`;
              return <Link key={k} href={href} aria-current={on ? "page" : undefined} className={seg(on)}>{t(`whose.${k}`)}</Link>;
            })}
          </nav>
        )}
        <nav aria-label={t("viewLabel")} className="flex rounded-[12px] bg-line-softer p-1">
          {VIEWS.map((v) => <Link key={v} href={q({ view: v })} aria-current={v === view ? "page" : undefined} className={seg(v === view)}>{t(`views.${v}`)}</Link>)}
        </nav>
        {/* One pill: Mon–Fri, «+ Σαβ/Κυρ» shows the weekend (and back). */}
        <Link href={q({ we: weekend ? undefined : "1" })} aria-pressed={weekend} title={t("daysLabel")}
          className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[12.5px] ${weekend ? "border-primary bg-primary-tint font-semibold text-primary" : "border-line-strong text-ink-3 hover:border-primary"}`}>
          {weekend ? t("weekOn") : t("weekOff")}
        </Link>
        {!doctor && (
          <span className="ml-auto flex gap-2">
            <span title={t("surgerySoon")} className="flex h-10 items-center whitespace-nowrap rounded-control bg-cal-blue/50 px-3 text-sm font-semibold text-white">+ {t("surgery")}</span>
            <Link href={nextFree ?? q({ view: undefined })} title={t("nextFreeHint")} className={`${primaryButton} min-h-10 whitespace-nowrap px-3.5`}>+ {t("appointment")}</Link>
          </span>
        )}
      </div>
      {carry ? (
        <CarryBar name={`${carry.label} ${carry.minutes}′`} sub={t("move.carryFrom", { from: carry.from })} />
      ) : (
        tiles.length > 0 && <TopStrip tiles={tiles} label={t("strip.label")} />
      )}
      <MoveToast />
      {doctor && !own && <p className="text-sm text-muted">{t("noOwnColumn")}</p>}
      {body}
    </main>
  );
}

// The front desk's top strip (DESIGN 6a–6g): Αιτήματα κράτησης · Επιβεβαιώσεις αύριο ·
// Λίστα αναμονής · Νέες φόρμες, and the GHL status. Those not built yet say when they come.
async function deskTiles(actor: Awaited<ReturnType<typeof loadActor>>, companyId: string, today: string): Promise<Tile[]> {
  const t = await getTranslations("calendar");
  const conf = await confirmations(actor, companyId, today);
  const dayLabel = conf ? fmt({ weekday: "short", day: "numeric", month: "numeric" }).format(at(conf.date)) : "";
  return [
    { key: "requests", label: t("strip.requests"), badge: { text: "–", tone: "grey" }, sub: t("strip.requestsSoon"), tone: "muted" },
    {
      key: "confirm",
      label: t("strip.confirm"),
      badge: { text: conf ? `${conf.confirmed}/${conf.total}` : "–", tone: conf?.pending.length ? "warn" : conf?.total ? "ok" : "grey" },
      sub: conf && [dayLabel, conf.pending.length ? t("strip.toCall", { count: conf.pending.length }) : null, conf.cannotNotify ? t("strip.cannotNotify", { count: conf.cannotNotify }) : null].filter(Boolean).join(" · "),
      body: conf ? (
        conf.pending.length ? (
          <ul className="flex flex-col divide-y divide-line-softer">
            {conf.pending.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 py-1.5">
                <b className="w-12 tabular-nums">{p.time}</b>
                {p.patientId ? <Link href={`/patients/${p.patientId}`} className="font-semibold hover:text-primary">{p.name}</Link> : <span>{p.name ?? "—"}</span>}
                <span className="text-muted">{p.type}</span>
                {p.reach === "none" && <span className="rounded-[6px] bg-danger-bg px-1.5 py-0.5 text-[11.5px] font-semibold text-danger-ink">{t("strip.noReach")}</span>}
                {p.reach === "email" && <span className="rounded-[6px] bg-line-softer px-1.5 py-0.5 text-[11.5px] text-ink-3">{t("strip.byEmail")}</span>}
                {p.phone && <a href={`tel:${p.phone.replace(/\s/g, "")}`} className="ml-auto font-semibold text-primary">{p.phone}</a>}
              </li>
            ))}
          </ul>
        ) : <span className="text-muted">{t("strip.allConfirmed")}</span>
      ) : undefined,
    },
    { key: "waitlist", label: t("strip.waitlist"), badge: { text: "–", tone: "grey" }, sub: t("strip.waitlistSoon"), tone: "muted" },
    { key: "forms", label: t("strip.forms"), badge: { text: "–", tone: "grey" }, sub: t("strip.formsSoon"), tone: "muted" },
    { key: "ghl", label: "GHL", status: true, value: t("strip.ghlOff"), sub: t("strip.ghlSoon") },
  ];
}
