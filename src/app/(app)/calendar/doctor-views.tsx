import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { FlagDot } from "@/components/patient-bits";
import { Badge, card, primaryButton } from "@/components/ui";
import { calColor } from "@/lib/calendar/colors";
import type { patientCard, RangeAppointment, RangeDay } from "@/lib/calendar/views";
import { NowLine } from "./now-line";

const PX = 72; // physician day: one wide timeline (DESIGN 6a–6f)
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const dayName = new Intl.DateTimeFormat("el-GR", { weekday: "short", day: "numeric", timeZone: "UTC" });
type Card = NonNullable<Awaited<ReturnType<typeof patientCard>>>;

// Physician day (DESIGN 6a–6f): his own appointments only, no money, no booking buttons.
export async function DoctorDay({
  day,
  resourceId,
  now,
  next,
  current,
  tomorrowCount,
}: {
  day: RangeDay;
  resourceId: string;
  now: number | null;
  next: { a: RangeAppointment; patient: Card | null; waiting: number | null } | null;
  current: RangeAppointment | null;
  tomorrowCount: number;
}) {
  const t = await getTranslations("calendar");
  const th = await getTranslations("history");
  const rr = day.resources[resourceId];
  const appts = day.appointments.filter((a) => a.resourceId === resourceId);
  const edges = [...(rr?.hours ?? []).flatMap((h) => [h.from, h.to]), ...appts.flatMap((a) => [a.start, a.end])];
  const startHour = edges.length ? Math.min(9, Math.floor(Math.min(...edges) / 60)) : 9;
  const endHour = edges.length ? Math.max(startHour + 8, Math.ceil(Math.max(...edges) / 60)) : 19;
  const top = (min: number) => ((min - startHour * 60) / 60) * PX;
  const active = appts.filter((a) => a.active);
  const pill = (a: RangeAppointment) => {
    if (a.id === current?.id) return <span className="rounded-full bg-primary px-2 py-0.5 text-[11.5px] font-semibold text-white">{t("nowPill")}</span>;
    if (a.status === "ARRIVED" || a.status === "READY") return <span className="text-[11.5px] font-semibold text-primary">{t("waiting")}</span>;
    if (a.status === "DONE" || a.status === "TO_PAY") return <span className="text-[11.5px]">✓ {t("done")}</span>;
    if (a.layer === "ONLINE") return <span className="rounded-full border border-line-strong px-2 text-[11px]">{t("video")}</span>;
    if (a.isNew) return <span className="text-[11.5px] font-semibold">{t("new")}</span>;
    return null;
  };
  return (
    <div className="flex flex-wrap items-start gap-5">
      <section className={`${card} min-w-0 flex-[999_1_560px] overflow-hidden p-4`}>
        {day.holiday && <div className="mb-2 rounded-[8px] bg-warn-bg px-3 py-1.5 text-sm font-semibold text-warn-ink">{t("holiday", { name: day.holiday })}</div>}
        <div className="relative" style={{ height: (endHour - startHour) * PX }}>
          {Array.from({ length: endHour - startHour + 1 }, (_, i) => (
            <div key={i} className="absolute left-0 right-0 border-t border-line-softer" style={{ top: i * PX }}>
              <span className="absolute -top-2 left-0 w-[46px] text-right text-[12px] text-muted">{hhmm((startHour + i) * 60)}</span>
            </div>
          ))}
          <div className="absolute inset-y-0 left-[58px] right-0">
            {rr?.blocks.map((b, i) => (
              <div key={i} className="absolute left-0 right-0 rounded-[8px] bg-[repeating-linear-gradient(45deg,var(--color-line-softer)_0_6px,var(--color-line)_6px_8px)] px-2 py-1 text-[12.5px] text-ink-3" style={{ top: top(b.start), height: top(b.end) - top(b.start) }}>
                {b.label ?? t(`blockKinds.${b.kind}`)} · {hhmm(b.start)}–{hhmm(b.end)}
              </div>
            ))}
            {appts.map((a) => (
              <Link key={a.id} href={a.patientId ? `/patients/${a.patientId}` : "#"}
                className={`absolute left-0 right-0 flex items-start justify-between gap-2 overflow-hidden rounded-[8px] px-3 py-1 text-[14px] ${calColor(a.color).box} ${!a.active ? "line-through opacity-40" : a.status === "DONE" || a.status === "TO_PAY" ? "opacity-60" : ""} ${a.id === current?.id ? "ring-2 ring-primary" : ""}`}
                style={{ top: top(a.start) + 1, height: Math.max(22, top(a.end) - top(a.start) - 2), zIndex: 2 }}>
                <span className="min-w-0 truncate"><b>{a.time}</b> <b>{a.name ?? a.typeLabel}</b> <span className="opacity-80">· {a.typeLabel}{a.reason && ` · ${a.reason}`}</span></span>
                <span className="shrink-0">{pill(a)}</span>
              </Link>
            ))}
          </div>
          <NowLine date={day.date} startHour={startHour} endHour={endHour} px={PX} left={58} />
        </div>
      </section>

      <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
        {current && (
          <section className={`${card} flex flex-col gap-1 px-5 py-4`}>
            <span className="text-[15px] font-semibold">{t("nowCard")}</span>
            <span className="text-sm">{current.name} · {current.typeLabel}</span>
          </section>
        )}
        {next ? (
          <section className={`${card} flex flex-col gap-2 border-2 border-primary px-5 py-4`}>
            <span className="text-[15px] font-semibold">{t("nextCard", { time: next.a.time })}{next.waiting !== null && ` · ${t("waitingFor", { minutes: next.waiting })}`}</span>
            {next.patient ? (
              <>
                <span className="text-[19px] font-semibold">{next.patient.name}{next.patient.age !== null && <span className="text-[14px] font-normal text-muted"> · {t("years", { age: next.patient.age })}</span>}</span>
                <span className="text-sm text-ink-3">{next.a.typeLabel}{next.a.reason && ` · ${next.a.reason}`}</span>
                <div className="flex flex-wrap gap-1.5">
                  {next.patient.flag !== "NONE" && (
                    <Badge tone={next.patient.flag === "RED" ? "red" : "amber"}><FlagDot flag={next.patient.flag} label={t("flagged")} />{next.patient.flagReasons.join(", ") || t("flagged")}</Badge>
                  )}
                  {next.patient.riskFactors.length > 0 && <Badge tone="red">{th("risk.title")}: {next.patient.riskFactors.map((r) => th(`risk.factors.${r}` as "risk.factors.thyroxine")).join(", ")}</Badge>}
                  {next.patient.infectious && <Badge tone="red">{t("infectious")}</Badge>}
                  <Badge tone={next.patient.history === "VERIFIED" ? "green" : "amber"}>{t(`historyState.${next.patient.history ?? "NONE"}`)}</Badge>
                </div>
                <Link href={`/patients/${next.patient.id}`} className={`${primaryButton} self-start`}>{t("openRecord")}</Link>
              </>
            ) : (
              <span className="text-sm">{next.a.typeLabel}</span>
            )}
          </section>
        ) : (
          <section className={`${card} px-5 py-4 text-sm text-muted`}>{t("noMore")}</section>
        )}
        <section className={`${card} grid grid-cols-2 gap-3 px-5 py-4`}>
          <span className="col-span-2 text-[15px] font-semibold">{t("glance")}</span>
          <span><b className="text-[20px]">{active.length}</b><br /><span className="text-[13px] text-muted">{t("appointmentsWord")}</span></span>
          <span><b className="text-[20px]">{active.filter((a) => a.isNew).length}</b><br /><span className="text-[13px] text-muted">{t("newPatients")}</span></span>
          <span><b className="text-[20px]">{active.filter((a) => a.layer === "ONLINE").length}</b><br /><span className="text-[13px] text-muted">online</span></span>
          <span><b className="text-[20px]">{active.length ? hhmm(Math.max(...active.map((a) => a.end))) : "—"}</b><br /><span className="text-[13px] text-muted">{t("lastEnds")}</span></span>
          {now !== null && <span className="col-span-2 text-[12.5px] text-muted">{t("tomorrowCount", { count: tomorrowCount })}</span>}
        </section>
      </aside>
    </div>
  );
}

// Physician week (DESIGN 6a–6f): one card per day — type of day, office hours and count,
// new patients by name and area, online, blocks. Surgeries join with Phase 4/6b.
export async function DoctorWeek({ days, resourceId, todayIso }: { days: RangeDay[]; resourceId: string; todayIso: string }) {
  const t = await getTranslations("calendar");
  const all = days.flatMap((d) => d.appointments.filter((a) => a.resourceId === resourceId && a.active));
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2 text-sm">
        <span className={`${card} px-4 py-2`}><b>{all.length}</b> {t("appointmentsWord")}</span>
        <span className={`${card} px-4 py-2`}><b>{all.filter((a) => a.isNew).length}</b> {t("newPatients")}</span>
        <span className={`${card} px-4 py-2`}><b>{all.filter((a) => a.layer === "ONLINE").length}</b> online</span>
        <span className={`${card} px-4 py-2 text-muted`}>{t("surgeriesLater")}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {days.map((d) => {
          const mine = d.appointments.filter((a) => a.resourceId === resourceId && a.active);
          const rr = d.resources[resourceId];
          return (
            <Link key={d.date} href={`/calendar?date=${d.date}`} className={`${card} flex min-h-[260px] flex-col gap-2 px-4 py-3 hover:border-primary ${d.date === todayIso ? "border-2 border-primary" : ""}`}>
              <span className="flex items-baseline justify-between text-[17px] font-semibold first-letter:uppercase">{dayName.format(new Date(`${d.date}T12:00:00Z`))}{d.date === todayIso && <span className="text-[12px] text-primary">{t("todayShort")}</span>}</span>
              {d.holiday ? <span className="text-sm text-muted">{d.holiday}</span> : (
                <>
                  {mine.length > 0 && <span className="self-start rounded-[6px] bg-primary px-2 py-0.5 text-[12px] font-semibold text-white">{t("officeChip")}</span>}
                  {mine.length > 0 && <span className="text-[13.5px]"><b>{t("officeChip")}</b> {hhmm(Math.min(...mine.map((a) => a.start)))}–{hhmm(Math.max(...mine.map((a) => a.end)))}</span>}
                  <span className="text-[13.5px]"><b className="text-[18px]">{mine.length}</b> {t("appointmentsWord")}</span>
                  {mine.some((a) => a.isNew) && (
                    <span className="flex flex-col gap-0.5 text-[13px]">
                      <span className="text-[12px] text-muted">{t("newPatients")}</span>
                      {mine.filter((a) => a.isNew).map((a) => <span key={a.id}>● {a.name}{a.reason && <span className="text-muted"> · {a.reason}</span>}</span>)}
                    </span>
                  )}
                  {mine.some((a) => a.layer === "ONLINE") && <span className="text-[12.5px] text-muted">Online: {mine.filter((a) => a.layer === "ONLINE").map((a) => a.name).join(", ")}</span>}
                  {rr?.blocks.map((b, i) => <span key={i} className="text-[12.5px] text-muted">{b.label ?? t(`blockKinds.${b.kind}`)} {hhmm(b.start)}–{hhmm(b.end)}</span>)}
                </>
              )}
              <span className="mt-auto text-[13px] font-semibold text-primary">{t("dayLink")} →</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// Physician month (DESIGN 6a–6f): appointments per day and holidays; totals on top.
export async function DoctorMonth({ days, resourceId, monthIso, todayIso }: { days: RangeDay[]; resourceId: string; monthIso: string; todayIso: string }) {
  const t = await getTranslations("calendar");
  const inMonth = days.filter((d) => d.date.slice(0, 7) === monthIso.slice(0, 7));
  const total = inMonth.reduce((n, d) => n + d.appointments.filter((a) => a.resourceId === resourceId && a.active).length, 0);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2 text-sm">
        <span className={`${card} px-4 py-2`}><b>{total}</b> {t("officeAppointments")}</span>
        <span className={`${card} px-4 py-2 text-muted`}>{t("surgeriesLater")}</span>
      </div>
      <section className={`${card} overflow-hidden`}>
        <div className="grid grid-cols-7 border-b border-line-soft text-[13px] font-semibold text-muted">
          {[1, 2, 3, 4, 5, 6, 7].map((w) => <div key={w} className="px-3 py-2">{t(`weekdays.${w}`)}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d) => {
            const mine = d.appointments.filter((a) => a.resourceId === resourceId && a.active).length;
            const inside = d.date.slice(0, 7) === monthIso.slice(0, 7);
            return (
              <Link key={d.date} href={`/calendar?date=${d.date}`} className={`flex min-h-[104px] flex-col gap-1 border-b border-r border-line-softer px-3 py-2 hover:bg-surface-2 ${inside ? "" : "bg-surface-2"}`}>
                <span className={`self-start text-[14px] ${inside ? "" : "text-placeholder"} ${d.date === todayIso ? "rounded-full bg-primary px-2 text-white" : ""}`}>{Number(d.date.slice(8))}</span>
                {inside && d.holiday && <span className="rounded-[6px] bg-line-softer px-2 py-0.5 text-[12px] font-semibold text-ink-3">{t("holidayShort")} · {d.holiday}</span>}
                {inside && mine > 0 && <span className="text-[13px] text-primary"><b>{mine}</b> {t("appointmentsWord")}</span>}
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
