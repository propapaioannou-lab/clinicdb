import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { FlagDot } from "@/components/patient-bits";
import { Badge, card, primaryButton } from "@/components/ui";
import { calColor } from "@/lib/calendar/colors";
import type { Scale } from "@/lib/calendar/bands";
import type { patientCard, RangeAppointment, RangeDay } from "@/lib/calendar/views";
import { ColumnBackground, Folds, GridLines, place, TimeAxis } from "./grid-bits";
import { NowLine } from "./now-line";
import type { Tile } from "./top-strip";

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const dayName = new Intl.DateTimeFormat("el-GR", { weekday: "short", day: "numeric", timeZone: "UTC" });
type Card = NonNullable<Awaited<ReturnType<typeof patientCard>>>;

// Physician day (DESIGN 6a–6g): his own appointments only, on the two-band grid; no
// money, no booking buttons. Τώρα / Επόμενος / Σήμερα / Αύριο are in the top strip.
export async function DoctorDay({ day, resourceId, current, scale }: { day: RangeDay; resourceId: string; current: RangeAppointment | null; scale: Scale }) {
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
      <div className="max-h-[calc(100vh-290px)] min-h-[420px] overflow-y-auto">
        <div className="relative grid grid-cols-[56px_minmax(0,1fr)]" style={{ height: scale.height }}>
          <TimeAxis scale={scale} />
          <div className="relative border-l border-line-soft">
            <ColumnBackground scale={scale} surgery={rr?.surgery ?? []} hours={rr?.hours ?? []} flex={rr?.flex ?? []} surgeryLabel={t("bands.surgery")} />
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
                  className={`absolute left-1 right-1 flex justify-between gap-2 overflow-hidden rounded-[8px] px-3 ${box.height < 30 ? "items-center text-[13px] leading-none" : "items-start py-1 text-[14px]"} ${calColor(a.color).box} ${!a.active ? "line-through opacity-40" : a.status === "DONE" || a.status === "TO_PAY" ? "opacity-60" : ""} ${a.id === current?.id ? "ring-2 ring-primary" : ""}`}
                  style={{ ...box, zIndex: 2 }}>
                  <span className="min-w-0 truncate"><b>{a.time}</b> <b>{a.name ?? a.typeLabel}</b> <span className="opacity-80">· {a.typeLabel}{a.reason && ` · ${a.reason}`}</span></span>
                  <span className="shrink-0">{pill(a)}</span>
                </Link>
              );
            })}
          </div>
          <Folds scale={scale} left={56} label={t("folded")} />
          <NowLine dates={[day.date]} scale={scale} left={56} focus={office?.from} />
        </div>
      </div>
    </section>
  );
}

// The physician's top strip (DESIGN 6a–6g): Τώρα · Επόμενος (rich) · Σήμερα · Αύριο.
export async function doctorTiles({ day, resourceId, next, current, tomorrowCount }: {
  day: RangeDay;
  resourceId: string;
  next: { a: RangeAppointment; patient: Card | null; waiting: number | null } | null;
  current: RangeAppointment | null;
  tomorrowCount: number;
}): Promise<Tile[]> {
  const t = await getTranslations("calendar");
  const th = await getTranslations("history");
  const active = day.appointments.filter((a) => a.resourceId === resourceId && a.active);
  const p = next?.patient;
  return [
    { key: "now", label: t("strip.now"), value: current ? current.name ?? current.typeLabel : "—", sub: current ? `${current.time} · ${current.typeLabel}` : t("strip.nobody"), tone: current ? "primary" : "neutral" },
    {
      key: "next",
      label: next ? t("nextCard", { time: next.a.time }) : t("strip.next"),
      wide: true,
      tone: next ? "neutral" : "muted",
      value: next ? (p ? <>{p.name}{p.age !== null && <span className="text-[14px] font-normal text-muted"> · {t("years", { age: p.age })}</span>}</> : next.a.typeLabel) : "—",
      sub: next ? (
        <span className="flex flex-wrap items-center gap-1.5">
          <span>{next.a.typeLabel}{next.a.reason && ` · ${next.a.reason}`}{next.waiting !== null && ` · ${t("waitingFor", { minutes: next.waiting })}`}</span>
          {p && p.flag !== "NONE" && <Badge tone={p.flag === "RED" ? "red" : "amber"}><FlagDot flag={p.flag} label={t("flagged")} />{p.flagReasons.join(", ") || t("flagged")}</Badge>}
          {p && p.riskFactors.length > 0 && <Badge tone="red">{th("risk.title")}</Badge>}
          {p?.infectious && <Badge tone="red">{t("infectious")}</Badge>}
          {p && <Badge tone={p.history === "VERIFIED" ? "green" : "amber"}>{t(`historyState.${p.history ?? "NONE"}`)}</Badge>}
        </span>
      ) : t("noMore"),
      body: p ? (
        <div className="flex flex-wrap items-center gap-3">
          {p.riskFactors.length > 0 && <span>{th("risk.title")}: {p.riskFactors.map((r) => th(`risk.factors.${r}` as "risk.factors.thyroxine")).join(", ")}</span>}
          <Link href={`/patients/${p.id}`} className={primaryButton}>{t("openRecord")}</Link>
        </div>
      ) : undefined,
    },
    {
      key: "today",
      label: t("strip.today"),
      value: t("strip.count", { count: active.length }),
      sub: [t("strip.newCount", { count: active.filter((a) => a.isNew).length }), `${active.filter((a) => a.layer === "ONLINE").length} online`, active.length ? `${t("lastEnds")} ${hhmm(Math.max(...active.map((a) => a.end)))}` : null].filter(Boolean).join(" · "),
    },
    { key: "tomorrow", label: t("strip.tomorrow"), value: t("strip.count", { count: tomorrowCount }) },
  ];
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
      <div className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-3 ${days.length > 5 ? "xl:grid-cols-7" : "xl:grid-cols-5"}`}>
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
export async function DoctorMonth({ days: all, resourceId, monthIso, todayIso, weekend }: { days: RangeDay[]; resourceId: string; monthIso: string; todayIso: string; weekend: boolean }) {
  const days = weekend ? all : all.filter((d) => d.weekday <= 5);
  const weekdays = weekend ? [1, 2, 3, 4, 5, 6, 7] : [1, 2, 3, 4, 5];
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
        <div className={`grid ${weekend ? "grid-cols-7" : "grid-cols-5"} border-b border-line-soft text-[13px] font-semibold text-muted`}>
          {weekdays.map((w) => <div key={w} className="px-3 py-2">{t(`weekdays.${w}`)}</div>)}
        </div>
        <div className={`grid ${weekend ? "grid-cols-7" : "grid-cols-5"}`}>
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
