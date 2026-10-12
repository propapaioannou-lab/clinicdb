import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LiveClock } from "@/components/live/live-clock";
import { FlagDot } from "@/components/patient-bits";
import { card, primaryButton, secondaryButton } from "@/components/ui";
import type { DayAppointment, DayData } from "@/lib/calendar/day";
import { STATUS_LABEL } from "@/lib/calendar/status";
import type { AppointmentStatus } from "@/generated/prisma/client";
import { greetingFor } from "@/lib/home/greeting";
import { StepButton } from "./buttons";
import { TodayList } from "./today-list";

// Home screens (Phase 6a-4, DESIGN 1a / 1b / 1e): each role sees today's work, kept live
// by <LiveRefresh>. No money on the physician's screen.

type Common = { data: DayData; nowMin: number; dateLabel: string; companyLabel: string };
const toMin = (hm: string | null) => (hm ? Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5)) : null);
const OPEN = ["BOOKED", "CONFIRMED", "ARRIVED", "READY"];

async function Later({ title, phase }: { title: string; phase: string }) {
  const t = await getTranslations("home");
  return (
    <section className={`${card} flex flex-col gap-1.5 p-5`}>
      <h2 className="text-[17px] font-semibold">{title}</h2>
      <p className="text-[13.5px] text-muted">{t("later", { phase })}</p>
    </section>
  );
}

// ── 1a · Physician ──────────────────────────────────────────────────────────────
export async function PhysicianHome({ data, nowMin, dateLabel, resourceIds }: Common & { resourceIds: string[] }) {
  const t = await getTranslations("home");
  const mine = data.appointments.filter((a) => a.active && resourceIds.includes(a.resourceId));
  const next = mine.find((a) => OPEN.includes(a.status) && a.end > nowMin);
  const g = greetingFor(data.date, Math.floor(nowMin / 60));
  const waiting = mine.filter((a) => a.status === "ARRIVED" || a.status === "READY").length;
  return (
    <main className="mx-auto flex w-full max-w-[1240px] flex-col gap-5 px-4 py-6 md:px-8">
      <div className="flex flex-wrap items-center gap-5">
        <div className={`${card} px-5 py-3`}><LiveClock date={data.date} nextStart={next?.start ?? null} /></div>
        <div className="flex flex-col">
          <span className="text-[13px] text-muted first-letter:uppercase">{dateLabel}</span>
          <h1 className="text-[28px] font-semibold leading-tight">{g.hello}</h1>
          <span className="text-[14px] text-ink-3">{g.line}</span>
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className={`${card} overflow-hidden`}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft px-5 py-3.5">
            <div>
              <h2 className="text-[17px] font-semibold">{t("myDay")}</h2>
              <span className="text-[13px] text-muted">{t("myDaySub", { count: mine.length, waiting })}</span>
            </div>
            <Link href="/calendar" className="text-[13.5px] font-semibold text-primary">{t("toCalendar")} →</Link>
          </div>
          <TodayList rows={mine.map((a) => ({
            id: a.id, start: a.start, end: a.end, time: a.time, name: a.patient?.short ?? null, patientId: a.patient?.id ?? null,
            type: a.type.label, color: a.type.color, reason: a.reason, status: a.status, room: a.room, visitId: a.visitId, flagged: !!a.patient && a.patient.flag !== "NONE",
          }))} />
        </section>
        <div className="flex flex-col gap-4">
          <Later title={t("chat")} phase="6a-5" />
          <Later title={t("tasks")} phase="6f" />
          <Later title={t("toCheck")} phase="4" />
        </div>
      </div>
    </main>
  );
}

// Rooms on the board: "Δωμάτιο" columns from Settings, else Δωμάτιο 1 and 2.
async function Header({ title, sub, aside }: { title: string; sub: string; aside?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <span className="text-[13px] text-muted first-letter:uppercase">{sub}</span>
        <h1 className="text-[28px] font-semibold leading-tight">{title}</h1>
      </div>
      {aside}
    </div>
  );
}

// The one next step for an appointment at the front (secretary and PA/nurse).
async function MainAction({ a, rooms }: { a: DayAppointment; rooms: string[] }) {
  const t = await getTranslations("home");
  const c = await getTranslations("calendar");
  switch (a.status) {
    case "BOOKED":
    case "CONFIRMED":
      return <StepButton id={a.id} to="ARRIVED" label={c("actions.ARRIVED")} />;
    case "ARRIVED":
      return <span className="flex flex-wrap justify-end gap-1.5">{rooms.map((r) => <StepButton key={r} id={a.id} to="READY" room={r} label={t("readyIn", { room: r })} />)}</span>;
    case "READY":
      return <span className="text-[13px] text-muted">{t("waitsDoctor")}</span>;
    case "WITH_DOCTOR":
      return <StepButton id={a.id} to="TO_PAY" kind="secondary" label={c("actions.TO_PAY")} />;
    case "TO_PAY":
      return a.visitId && a.patient
        ? <Link href={`/patients/${a.patient.id}/visits/${a.visitId}`} className={`${primaryButton} min-h-10 px-3 text-[13.5px]`}>{t("collect")}</Link>
        : <StepButton id={a.id} to="DONE" label={t("collect")} />;
    default:
      return <span className="text-[13px] text-ok-ink">✓ {STATUS_LABEL[a.status as AppointmentStatus]}</span>;
  }
}

function Name({ a }: { a: DayAppointment }) {
  if (!a.patient) return <b>{a.type.label}</b>;
  return (
    <span className="font-semibold">
      <Link href={`/patients/${a.patient.id}`} className="hover:underline">{a.patient.name}</Link>
      {a.patient.flag !== "NONE" && <span className="ml-1 inline-block align-middle"><FlagDot flag={a.patient.flag as "YELLOW" | "RED"} label="!" /></span>}
    </span>
  );
}

// ── 1b · PA / nurse ─────────────────────────────────────────────────────────────
export async function PaHome({ data, nowMin, dateLabel, companyLabel, rooms }: Common & { rooms: string[] }) {
  const t = await getTranslations("home");
  const appts = data.appointments.filter((a) => a.active);
  const waiting = appts.filter((a) => a.status === "ARRIVED");
  const withDoctor = appts.find((a) => a.status === "WITH_DOCTOR");
  const late = withDoctor ? (toMin(withDoctor.statusAt) ?? nowMin) - withDoctor.start : 0;
  const inRoom = (room: string) => appts.find((a) => (a.status === "READY" || a.status === "WITH_DOCTOR") && a.room === room);
  return (
    <main className="mx-auto flex w-full max-w-[1400px] flex-col gap-5 px-4 py-6 md:px-8">
      <Header title={t("flow")} sub={`${companyLabel} · ${dateLabel} · ${t("appointmentsCount", { count: appts.length })}`}
        aside={
          <span className="flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-[13.5px]">
            <span className={`h-2.5 w-2.5 rounded-full ${withDoctor ? "bg-ok" : "bg-line-strong"}`} />
            {withDoctor
              ? <>{t("doctorWith", { room: withDoctor.room ?? "—", name: withDoctor.patient?.short ?? withDoctor.type.label, since: withDoctor.statusAt ?? "" })}
                  {late > 0 && <b className="text-warn-ink">{t("behind", { minutes: late })}</b>}</>
              : t("doctorFree")}
          </span>
        } />
      <div className="grid gap-4 md:grid-cols-[repeat(auto-fit,minmax(260px,1fr))]">
        <section className={`${card} flex flex-col gap-3 p-5`}>
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted">{t("waitingRoom")} · {waiting.length}</h2>
          {!waiting.length && <p className="text-[14px] text-muted">{t("nobodyWaiting")}</p>}
          {waiting.map((a) => (
            <div key={a.id} className="flex flex-col gap-2 border-t border-line-softer pt-3 first:border-0 first:pt-0">
              <Name a={a} />
              <span className="text-[13px] text-muted">{t("arrivedLine", { arrived: a.arrivedAt ?? "—", time: a.time })} · {a.type.label}</span>
              <MainAction a={a} rooms={rooms} />
            </div>
          ))}
        </section>
        {rooms.map((room) => {
          const a = inRoom(room);
          const busy = a?.status === "WITH_DOCTOR";
          return (
            <section key={room} className={`flex flex-col gap-2 rounded-card p-5 ${busy ? "border-2 border-primary bg-surface" : a ? "border border-ok bg-ok-bg/40" : "border border-dashed border-line-strong bg-surface"}`}>
              <h2 className={`text-[13px] font-semibold uppercase tracking-wide ${busy ? "text-primary" : "text-muted"}`}>
                {room}{busy ? ` · ${t("withDoctorUpper")}` : a ? ` · ${t("readyUpper")}` : ""}
              </h2>
              {a ? (
                <>
                  <Name a={a} />
                  <span className="text-[13px] text-muted">{a.type.label}{a.statusAt && ` · ${t("since", { time: a.statusAt })}`}</span>
                  {busy && <MainAction a={a} rooms={rooms} />}
                </>
              ) : <span className="text-[14px] text-muted">{t("roomFree")}</span>}
            </section>
          );
        })}
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Schedule data={data} rooms={rooms} />
        <div className="flex flex-col gap-4">
          <Later title={t("pending")} phase="3" />
          <Later title={t("surgeryChecks")} phase="4" />
          <Later title={t("chatDoctor")} phase="6a-5" />
        </div>
      </div>
    </main>
  );
}

async function Schedule({ data, rooms }: { data: DayData; rooms: string[] }) {
  const t = await getTranslations("home");
  const rows = data.appointments.filter((a) => a.active);
  return (
    <section className={`${card} overflow-hidden`}>
      <div className="flex items-center justify-between border-b border-line-soft px-5 py-3.5">
        <h2 className="text-[17px] font-semibold">{t("todayAppointments")}</h2>
        <Link href="/calendar" className="text-[13.5px] font-semibold text-primary">{t("toCalendar")} →</Link>
      </div>
      {!rows.length && <p className="px-5 py-8 text-center text-muted">{t("noAppointments")}</p>}
      <ul>
        {rows.map((a) => (
          <li key={a.id} className={`flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line-softer px-5 py-3 last:border-0 ${a.status === "DONE" ? "opacity-55" : ""}`}>
            <span className="w-12 text-[15px] font-semibold tabular-nums">{a.time}</span>
            <span className="flex min-w-[170px] flex-1 flex-col">
              <Name a={a} />
              <span className="text-[13px] text-muted">{a.type.label}{a.reason && ` · ${a.reason}`}</span>
            </span>
            <span className="w-[120px] text-[13px]">{a.status === "BOOKED" ? <span className="text-warn-ink">? {t("unconfirmed")}</span> : <span className="text-ok-ink">✓ {t("confirmed")}</span>}</span>
            <span className="w-[130px] text-[13px] font-semibold">{STATUS_LABEL[a.status as AppointmentStatus]}{a.status === "READY" && a.room && ` · ${a.room}`}</span>
            <span className="flex min-w-[150px] flex-wrap items-center justify-end gap-2">
              <MainAction a={a} rooms={rooms} />
              {(a.status === "BOOKED" || a.status === "CONFIRMED") && <StepButton id={a.id} to="NO_SHOW" kind="link" label={t("noShow")} />}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── 1e · Front desk ─────────────────────────────────────────────────────────────
export async function DeskHome({ data, dateLabel, companyLabel, rooms }: Common & { rooms: string[] }) {
  const t = await getTranslations("home");
  const appts = data.appointments.filter((a) => a.active);
  const tiles = [
    { n: appts.length, label: t("tiles.appointments") },
    { n: appts.filter((a) => a.status === "ARRIVED" || a.status === "READY").length, label: t("tiles.waiting") },
    { n: appts.filter((a) => a.status === "TO_PAY").length, label: t("tiles.toPay"), warn: true },
    { n: appts.filter((a) => a.status === "DONE").length, label: t("tiles.done") },
  ];
  const tm = data.tomorrow;
  return (
    <main className="mx-auto flex w-full max-w-[1400px] flex-col gap-5 px-4 py-6 md:px-8">
      <Header title={t("reception")} sub={`${dateLabel} · ${companyLabel}`}
        aside={<Link href="/calendar?book=1" className={primaryButton}>+ {t("newAppointment")}</Link>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((x) => (
          <div key={x.label} className={`${card} px-4 py-3`}>
            <div className={`text-[26px] font-semibold tabular-nums ${x.warn && x.n ? "text-warn-ink" : ""}`}>{x.n}</div>
            <div className="text-[13px] text-muted">{x.label}</div>
          </div>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Schedule data={data} rooms={rooms} />
        <div className="flex flex-col gap-4">
          <section className={`${card} flex flex-col gap-3 p-5`}>
            <div className="flex items-center justify-between">
              <h2 className="text-[17px] font-semibold">{t("tomorrowConf")}</h2>
              <span className="text-[13px] font-semibold text-primary">{tm.confirmed}/{tm.total}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-line-softer">
              <div className="h-full bg-ok" style={{ width: `${tm.total ? (tm.confirmed / tm.total) * 100 : 0}%` }} />
            </div>
            <Link href={`/calendar?date=${data.tomorrowDate}`} className={`${secondaryButton} min-h-10 text-[13.5px]`}>{t("openTomorrow")}</Link>
          </section>
          <Later title={t("waitingList")} phase="6e" />
          <Later title={t("surgeriesAdmin")} phase="4" />
          <Later title={t("chat")} phase="6a-5" />
        </div>
      </div>
    </main>
  );
}
