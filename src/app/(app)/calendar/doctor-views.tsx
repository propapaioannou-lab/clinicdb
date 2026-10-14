import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { FlagDot } from "@/components/patient-bits";
import { Badge, card, primaryButton } from "@/components/ui";
import { calColor } from "@/lib/calendar/colors";
import type { Scale } from "@/lib/calendar/bands";
import type { patientCard, RangeAppointment, RangeDay } from "@/lib/calendar/views";
import { CardText, ColumnBackground, dur, Folds, GridLines, Legend, place, SurgeryBar, TimeAxis } from "./grid-bits";
import { NowLine } from "./now-line";
import { athensSlot } from "@/lib/calendar/appointments";
import { dueBoost, PRIORITY } from "@/lib/calendar/priority";
import type { Tile } from "./top-strip";

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const dayName = new Intl.DateTimeFormat("el-GR", { weekday: "short", day: "numeric", timeZone: "UTC" });
type Card = NonNullable<Awaited<ReturnType<typeof patientCard>>>;

// Physician day (DESIGN 6a–6g): his own appointments only, on the two-band grid; no
// money, no booking buttons. Τώρα / Επόμενος / Σήμερα / Αύριο are in the top strip.
export async function DoctorDay({ day, resourceId, current, scale, types }: { day: RangeDay; resourceId: string; current: RangeAppointment | null; scale: Scale; types: { label: string; minutes: number; color: string }[] }) {
  const t = await getTranslations("calendar");
  const rr = day.resources[resourceId];
  const appts = day.appointments.filter((a) => a.resourceId === resourceId);
  const office = scale.bands.find((b) => b.kind === "office");
  const pill = (a: RangeAppointment) => {
    if (a.id === current?.id) return <span className="rounded-full bg-primary px-2 py-0.5 text-[11.5px] font-semibold text-white">{t("nowPill")}</span>;
    if (a.status === "ARRIVED" || a.status === "READY") return <span className="text-[11.5px] font-semibold text-primary">{t("waiting")}</span>;
    if (a.status === "DONE" || a.status === "TO_PAY") return <span className="text-[11.5px]">✓ {t("done")}</span>;
    if (a.layer === "ONLINE") return <span className="rounded-full border border-line-strong px-2 text-[11px]">{t("video")}</span>;
    if (a.isNew) return <span className="text-[11.5px] font-semibold">{t("new")}</span>;
    return null;
  };
  return (
    <section className={`${card} overflow-hidden`}>
      {day.holiday && <div className="bg-warn-bg px-4 py-2 text-sm font-semibold text-warn-ink">{t("holiday", { name: day.holiday })}</div>}
      <div className="max-h-[calc(100dvh-290px)] min-h-[420px] overflow-y-auto max-md:max-h-[calc(100dvh-260px)] lg:max-h-[calc(100dvh-190px)]">
        <div className="relative grid grid-cols-[64px_minmax(0,1fr)]" style={{ height: scale.height }}>
          <TimeAxis scale={scale} labels={{ surgery: t("bands.surgery"), office: t("bands.office") }} />
          <div className="relative border-l border-line-soft">
            <ColumnBackground scale={scale} surgery={rr?.surgery ?? []} hours={rr?.hours ?? []} flex={rr?.flex ?? []} labels={{ overrun: t("overrun", { time: "{time}" }), flex: t("flexLabel") }} />
            <GridLines scale={scale} />
            {rr?.blocks.map((b, i) => (
              <div key={i} className="absolute left-1 right-1 rounded-[8px] bg-[repeating-linear-gradient(45deg,var(--color-line-softer)_0_6px,var(--color-line)_6px_8px)] px-2 py-1 text-[12.5px] text-ink-3" style={place(scale, b.start, b.end)}>
                {b.label ?? t(`blockKinds.${b.kind}`)} · {hhmm(b.start)}–{hhmm(b.end)}
              </div>
            ))}
            {appts.map((a) => {
              const box = place(scale, a.start, a.end);
              return (
                <Link key={a.id} href={a.patientId ? `/patients/${a.patientId}` : "#"}
                  className={`absolute left-1 right-1 flex justify-between gap-2 overflow-hidden rounded-[8px] px-3 ${box.height < 34 ? "items-center text-[13px] leading-none" : "items-start py-1 text-[14px]"} ${calColor(a.color).box} ${!a.active ? "line-through opacity-40" : a.status === "DONE" || a.status === "TO_PAY" ? "opacity-60" : ""} ${a.id === current?.id ? "ring-2 ring-primary" : ""}`}
                  style={{ ...box, zIndex: 2 }}>
                  <CardText h={a.active ? box.height : 0} time={a.time} end={a.end} name={a.name ?? a.typeLabel} type={a.typeLabel} reason={a.reason} surgery={a.layer === "SURGERY"} />
                  <span className="shrink-0">{pill(a)}</span>
                </Link>
              );
            })}
          </div>
          <Folds scale={scale} left={64} label={t("folded")} />
          <NowLine dates={[day.date]} scale={scale} left={64} focus={office?.from} />
        </div>
      </div>
      <Legend types={[...types, { label: t("surgery"), minutes: 0, color: "blue" }]} zones={{ flex: t("legend.flex"), closed: t("legend.closedShort") }} />
    </section>
  );
}

// The physician's top strip (DESIGN 6a–6g): Τώρα · Επόμενος (rich, «Καρτέλα») · Σήμερα ·
// Αύριο (the first surgery, or the first appointment).
export async function doctorTiles({ day, resourceId, next, current, tomorrow }: {
  day: RangeDay;
  resourceId: string;
  next: { a: RangeAppointment; patient: Card | null; waiting: number | null } | null;
  current: RangeAppointment | null;
  tomorrow: RangeAppointment[];
}): Promise<Tile[]> {
  const t = await getTranslations("calendar");
  const th = await getTranslations("history");
  const active = day.appointments.filter((a) => a.resourceId === resourceId && a.active);
  const ops = active.filter((a) => a.layer === "SURGERY");
  const office = active.filter((a) => a.layer !== "SURGERY");
  const p = next?.patient;
  const firstTomorrow = tomorrow.find((a) => a.layer === "SURGERY") ?? tomorrow[0];
  const due = (a: RangeAppointment) => {
    const from = athensSlot(day.date, hhmm(a.start));
    const to = athensSlot(day.date, hhmm(a.end));
    return from && to ? [dueBoost(from.toISOString(), to.toISOString())] : [];
  };
  return [
    { key: "now", label: current ? t("strip.nowIn", { room: current.room ?? "—" }) : t("strip.now"), value: current ? `${current.name ?? current.typeLabel} · ${current.typeLabel}` : t("strip.nobody"), rank: { base: PRIORITY.base.now, boosts: current ? [{ add: PRIORITY.busy }] : [] } },
    {
      key: "next",
      // Rises when the patient's time comes (10′ before) or they are waiting (calendar v3).
      rank: { base: PRIORITY.base.next, boosts: next ? [...due(next.a), ...(next.waiting !== null ? [{ add: PRIORITY.waiting }] : [])] : [] },
      label: next ? `${t("nextCard", { time: next.a.time })}${next.waiting !== null ? ` · ${t("waitingFor", { minutes: next.waiting })}` : ""}` : t("strip.next"),
      wide: true,
      tone: next ? "primary" : "neutral",
      value: next ? <>{p ? `${p.name}${p.age !== null ? `, ${p.age}` : ""}` : next.a.typeLabel} <span className="text-[13px] font-normal text-ink-3">{next.a.typeLabel}{next.a.reason && ` · ${next.a.reason}`}</span></> : t("noMore"),
      sub: p ? (
        <span className="flex flex-wrap items-center gap-1.5">
          {p.flag !== "NONE" && <Badge tone={p.flag === "RED" ? "red" : "amber"}><FlagDot flag={p.flag} label={t("flagged")} />{p.flagReasons.join(", ") || t("flagged")}</Badge>}
          {p.riskFactors.length > 0 && <Badge tone="red">{p.riskFactors.map((r) => th(`risk.factors.${r}` as "risk.factors.thyroxine")).join(", ")}</Badge>}
          {p.infectious && <Badge tone="red">{t("infectious")}</Badge>}
          <Badge tone={p.history === "VERIFIED" ? "green" : "amber"}>{t(`historyState.${p.history ?? "NONE"}`)}</Badge>
        </span>
      ) : undefined,
      action: p ? <Link href={`/patients/${p.id}`} className={`${primaryButton} min-h-9 px-3.5 text-[13.5px]`}>{t("recordShort")}</Link> : undefined,
    },
    {
      key: "today",
      rank: { base: PRIORITY.base.today },
      label: t("strip.today"),
      value: [ops.length ? t("strip.opsCount", { count: ops.length }) : null, t("strip.count", { count: office.length }), t("strip.newCount", { count: office.filter((a) => a.isNew).length })].filter(Boolean).join(" · "),
    },
    {
      key: "tomorrow",
      rank: { base: PRIORITY.base.tomorrow },
      label: firstTomorrow?.layer === "SURGERY" ? t("strip.tomorrowSurgery") : t("strip.tomorrow"),
      value: firstTomorrow ? `${firstTomorrow.time} ${firstTomorrow.name ?? ""}${firstTomorrow.reason ? ` · ${firstTomorrow.reason}` : ""}` : "—",
      sub: tomorrow.some((a) => a.layer !== "SURGERY") ? t("strip.count", { count: tomorrow.filter((a) => a.layer !== "SURGERY").length }) : undefined,
    },
  ];
}

// Physician week (DESIGN 6a–6g): one card per day — surgeries (time, patient, procedure,
// length) with the surgery-time bar, then office hours, count, new patients, online.
export async function DoctorWeek({ days, resourceId, todayIso }: { days: RangeDay[]; resourceId: string; todayIso: string }) {
  const t = await getTranslations("calendar");
  const all = days.flatMap((d) => d.appointments.filter((a) => a.resourceId === resourceId && a.active));
  const office = all.filter((a) => a.layer !== "SURGERY");
  const chip = "rounded-full border border-line bg-surface px-3.5 py-1.5";
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2 text-sm">
        <span className={chip}><b>{all.length - office.length}</b> {t("surgeriesWord")}</span>
        <span className={chip}><b>{office.length}</b> {t("appointmentsWord")}</span>
        <span className={chip}><b>{office.filter((a) => a.isNew).length}</b> {t("newPatients")}</span>
        <span className={chip}><b>{office.filter((a) => a.layer === "ONLINE").length}</b> online</span>
      </div>
      <div className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-3 ${days.length > 5 ? "xl:grid-cols-7" : "xl:grid-cols-5"}`}>
        {days.map((d) => {
          const mine = d.appointments.filter((a) => a.resourceId === resourceId && a.active);
          const ops = mine.filter((a) => a.layer === "SURGERY");
          const appts = mine.filter((a) => a.layer !== "SURGERY");
          const rr = d.resources[resourceId];
          const span = (xs: { from: number; to: number }[]) => (xs.length ? `${hhmm(Math.min(...xs.map((x) => x.from)))}–${hhmm(Math.max(...xs.map((x) => x.to)))}` : null);
          return (
            <Link key={d.date} href={`/calendar?date=${d.date}`} className={`${card} flex min-h-[300px] flex-col gap-2 px-4 py-3 hover:border-primary ${d.date === todayIso ? "border-2 border-primary" : ""}`}>
              <span className="flex items-baseline justify-between text-[17px] font-semibold first-letter:uppercase">{dayName.format(new Date(`${d.date}T12:00:00Z`))}{d.date === todayIso && <span className="text-[12px] text-primary">{t("todayShort")}</span>}</span>
              {d.holiday ? <span className="text-sm text-muted">{d.holiday}</span> : (
                <>
                  {rr?.surgery.length ? <span className="text-[12.5px] text-muted">{t("surgeryWindow", { span: span(rr.surgery) ?? "" })}</span> : null}
                  {ops.map((a) => (
                    <span key={a.id} className="flex flex-col rounded-[8px] bg-cal-blue px-2.5 py-1.5 text-[12.5px] text-white">
                      <b>{a.time} {a.name}</b>
                      <span className="opacity-85">{[a.reason, dur(a.end - a.start)].filter(Boolean).join(" · ")}</span>
                    </span>
                  ))}
                  {rr?.load && (rr.load.ops > 0) && <SurgeryBar load={rr.load} text={`Χ ${dur(rr.load.used)} · ${t(`load.${rr.load.state}`, { x: dur(rr.load.remaining) })}`} />}
                  <span className="mt-1 border-t border-line-softer pt-2 text-[13.5px]">
                    {rr?.hours.length ? <><b>{t("officeChip")}</b> {span(rr.hours)}</> : <span className="text-muted">{t("afternoonClosed")}</span>}
                  </span>
                  {appts.length > 0 && <span className="text-[13.5px]"><b className="text-[18px]">{appts.length}</b> {t("appointmentsWord")}</span>}
                  {appts.some((a) => a.isNew) && (
                    <span className="flex flex-col gap-0.5 text-[13px]">
                      <span className="text-[12px] text-muted">{t("newPatients")}</span>
                      {appts.filter((a) => a.isNew).map((a) => <span key={a.id}>● {a.name}{a.reason && <span className="text-muted"> · {a.reason}</span>}</span>)}
                    </span>
                  )}
                  {appts.some((a) => a.layer === "ONLINE") && <span className="text-[12.5px] text-muted">Online: {appts.filter((a) => a.layer === "ONLINE").map((a) => a.name).join(", ")}</span>}
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

// Physician month (DESIGN 6a–6g): per day a navy block "Χειρ. ×2 · 5ω" with the
// procedures, then the office appointments; totals on top.
export async function DoctorMonth({ days: all, resourceId, monthIso, todayIso, weekend }: { days: RangeDay[]; resourceId: string; monthIso: string; todayIso: string; weekend: boolean }) {
  const days = weekend ? all : all.filter((d) => d.weekday <= 5);
  const weekdays = weekend ? [1, 2, 3, 4, 5, 6, 7] : [1, 2, 3, 4, 5];
  const t = await getTranslations("calendar");
  const inMonth = days.filter((d) => d.date.slice(0, 7) === monthIso.slice(0, 7));
  const mineOf = (d: RangeDay) => d.appointments.filter((a) => a.resourceId === resourceId && a.active);
  const ops = inMonth.flatMap((d) => mineOf(d).filter((a) => a.layer === "SURGERY"));
  const chip = "rounded-full border border-line bg-surface px-3.5 py-1.5";
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2 text-sm">
        <span className={chip}><b>{new Set(ops.map((a) => a.day)).size}</b> {t("surgeryDays")}</span>
        <span className={chip}><b>{ops.length}</b> {t("surgeriesWord")}</span>
        <span className={chip}><b>{inMonth.reduce((n, d) => n + mineOf(d).filter((a) => a.layer !== "SURGERY").length, 0)}</b> {t("officeAppointments")}</span>
        <span className={chip}><b>{inMonth.filter((d) => d.resources[resourceId]?.load?.state === "over").length}</b> {t("overruns")}</span>
      </div>
      <section className={`${card} overflow-hidden`}>
        <div className={`grid ${weekend ? "grid-cols-7" : "grid-cols-5"} border-b border-line-soft text-[13px] font-semibold text-muted`}>
          {weekdays.map((w) => <div key={w} className="px-3 py-2">{t(`weekdays.${w}`)}</div>)}
        </div>
        <div className={`grid ${weekend ? "grid-cols-7" : "grid-cols-5"}`}>
          {days.map((d) => {
            const mine = mineOf(d);
            const dayOps = mine.filter((a) => a.layer === "SURGERY");
            const office = mine.length - dayOps.length;
            const load = d.resources[resourceId]?.load;
            const inside = d.date.slice(0, 7) === monthIso.slice(0, 7);
            return (
              <Link key={d.date} href={`/calendar?date=${d.date}`} className={`flex min-h-[112px] flex-col gap-1.5 border-b border-r border-line-softer px-3 py-2 hover:bg-surface-2 ${inside ? "" : "bg-surface-2"}`}>
                <span className={`self-start text-[14px] ${inside ? "" : "text-placeholder"} ${d.date === todayIso ? "rounded-full bg-primary px-2 text-white" : ""}`}>{Number(d.date.slice(8))}</span>
                {inside && d.holiday && <span className="rounded-[6px] bg-line-softer px-2 py-0.5 text-[12px] font-semibold text-ink-3">{t("holidayShort")} · {d.holiday}</span>}
                {inside && dayOps.length > 0 && (
                  <span className="flex flex-col rounded-[7px] bg-cal-blue px-2 py-1 text-[12px] text-white">
                    <b>{t("surgeryShort")} ×{dayOps.length} · {dur(load?.used ?? 0)}{load?.state === "over" && " ⚠"}</b>
                    <span className="truncate opacity-85">{dayOps.map((a) => a.reason).filter(Boolean).join(" · ")}</span>
                  </span>
                )}
                {inside && office > 0 && <span className="text-[13px] text-primary"><b>{office}</b> {t("officeAppointments")}</span>}
              </Link>
            );
          })}
        </div>
      </section>
      <p className="text-[12.5px] text-muted">{t("weekendNote")}</p>
    </div>
  );
}
