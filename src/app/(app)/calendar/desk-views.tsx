import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { card } from "@/components/ui";
import { calColor } from "@/lib/calendar/colors";
import type { Scale } from "@/lib/calendar/bands";
import type { RangeDay } from "@/lib/calendar/views";
import { CardText, ColumnBackground, Folds, GridLines, Legend, place, SurgeryBar, TimeAxis } from "./grid-bits";
import { DragSurface, type ApptInfo, type Carry, type ColInfo } from "./drag-surface";
import { NowLine } from "./now-line";

const duration = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}ω${min % 60 ? ` ${min % 60}′` : ""}` : `${min}′`);
const dayName = new Intl.DateTimeFormat("el-GR", { weekday: "short", day: "numeric", timeZone: "UTC" });
const freeTone = (min: number) => (min === 0 ? "text-danger-ink" : min < 120 ? "text-warn-ink" : "text-ok-ink");

// Secretary week (DESIGN 6a–6g): Mon–Fri (Sat/Sun on demand) on the two-band grid, one
// line per appointment with ✓ / ?, closed hours grey, flex zones hatched, "ελεύθερα" per
// day (normal hours only); the nurse column on demand.
export async function DeskWeek({ days, resources, todayIso, scale, types, carry }: { days: RangeDay[]; resources: { id: string; label: string }[]; todayIso: string; scale: Scale; types: { label: string; minutes: number; color: string }[]; carry?: Carry | null }) {
  const t = await getTranslations("calendar");
  const lanes = resources.length;
  const cols = `64px repeat(${days.length}, minmax(0, 1fr))`;
  const office = scale.bands.find((b) => b.kind === "office");
  return (
    <section className={`${card} overflow-hidden`}>
      <div className="grid border-b border-line-soft" style={{ gridTemplateColumns: cols }}>
        <span />
        {days.map((d) => {
          // Office: free time in normal hours; surgery: the day's bar (first column = the doctor).
          const free = Object.values(d.resources).reduce((n, r) => n + r.freeMinutes, 0);
          const open = Object.values(d.resources).some((r) => r.hours.length);
          const load = resources.map((r) => d.resources[r.id]?.load).find(Boolean);
          return (
            <Link key={d.date} href={`/calendar?date=${d.date}${carry ? `&carry=${carry.id}` : ""}`} className={`flex flex-col gap-0.5 border-l border-line-soft px-3 py-2 hover:bg-surface-2 ${d.date === todayIso ? "bg-primary-tint" : ""}`}>
              <div className="text-[15px] font-semibold first-letter:uppercase">{dayName.format(new Date(`${d.date}T12:00:00Z`))}{d.date === todayIso && <span className="ml-1 text-[12px] font-semibold text-primary">{t("todayShort")}</span>}</div>
              <div className={`text-[12.5px] font-semibold ${d.holiday || !open ? "text-muted" : freeTone(free)}`}>
                {d.holiday ?? `${t("officeShort")}: ${open ? (free ? t("freeShort", { free: duration(free) }) : t("load.full")) : t("closedShort")}`}
              </div>
              {!d.holiday && load && (load.ops > 0 || load.window > 0) && <SurgeryBar load={load} text={`Χ ${duration(load.used)} · ${t(`load.${load.state}`, { x: duration(load.remaining) })}`} />}
            </Link>
          );
        })}
      </div>
      <div className="max-h-[calc(100vh-290px)] min-h-[420px] overflow-y-auto">
        <DragSurface scale={scale} carry={carry} className="relative grid" style={{ gridTemplateColumns: cols, height: scale.height }}>
          <TimeAxis scale={scale} labels={{ surgery: t("bands.surgery"), office: t("bands.office") }} />
          {days.map((d) => (
            <div key={d.date} className="relative grid border-l border-line-soft" style={{ gridTemplateColumns: `repeat(${lanes}, minmax(0, 1fr))` }}>
              {resources.map((r, li) => {
                const rr = d.resources[r.id];
                return (
                  <div key={r.id} className={`relative ${li ? "border-l border-dashed border-line-soft" : ""}`}
                    data-col={JSON.stringify({ date: d.date, resourceId: r.id, weekday: d.weekday, normal: rr?.hours ?? [], flex: rr?.flex ?? [] } satisfies ColInfo)}>
                    <ColumnBackground scale={scale} surgery={rr?.surgery ?? []} hours={rr?.hours ?? []} flex={rr?.flex ?? []} />
                    {li === 0 && !rr?.hours.length && !d.holiday && <span className="absolute left-2 text-[11px] text-muted" style={{ top: (scale.bands.find((b) => b.kind === "office")?.top ?? 0) + 4 }}>{t("closedOffice")}</span>}
                    <GridLines scale={scale} />
                    {rr?.blocks.map((b, i) => (
                      <div key={i} className="absolute left-0.5 right-0.5 overflow-hidden rounded-[6px] bg-[repeating-linear-gradient(45deg,var(--color-line-softer)_0_6px,var(--color-line)_6px_8px)] px-1.5 text-[11px] text-ink-3" style={place(scale, b.start, b.end, 14)}>
                        {b.label ?? t(`blockKinds.${b.kind}`)}
                      </div>
                    ))}
                    {d.appointments.filter((a) => a.resourceId === r.id && a.active).map((a) => {
                      const box = place(scale, a.start, a.end, 14);
                      const movable = a.status !== "DONE" && a.layer !== "SURGERY";
                      return (
                        <Link key={a.id} href={`/calendar?date=${d.date}`} title={`${a.time} ${a.name ?? ""} · ${a.typeLabel}${a.reason ? ` · ${a.reason}` : ""}`} draggable={false}
                          data-appt={JSON.stringify({ id: a.id, date: d.date, resourceId: a.resourceId, start: a.start, end: a.end, active: a.active, movable, label: `${a.name ?? a.typeLabel} · ${a.typeLabel} ${a.end - a.start}′` } satisfies ApptInfo)}
                          className={`absolute left-0.5 right-0.5 flex justify-between gap-1 overflow-hidden rounded-[5px] px-1.5 text-[11.5px] ${box.height >= 34 ? "items-start py-1" : "items-center leading-none"} ${calColor(a.color).box} ${a.status === "DONE" ? "opacity-60" : ""} ${movable ? "cursor-grab touch-none" : ""}`}
                          style={{ ...box, zIndex: 2 }}>
                          <CardText h={box.height} time={a.time} end={a.end} name={a.name ?? a.typeLabel} type={a.typeLabel} reason={a.layer === "SURGERY" ? a.reason : null} surgery={a.layer === "SURGERY"} />
                          {a.layer !== "SURGERY" && <span className={`shrink-0 ${a.status === "BOOKED" ? "rounded-full bg-warn-bg px-1 font-semibold text-warn-ink" : ""}`}>{a.status === "BOOKED" ? "?" : "✓"}</span>}
                          {movable && <span data-resize aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize" />}
                        </Link>
                      );
                    })}
                  </div>
                );
              })}
              {d.date === todayIso && <NowLine dates={[d.date]} scale={scale} focus={office?.from} />}
            </div>
          ))}
          <Folds scale={scale} left={64} label={t("folded")} />
          {!days.some((d) => d.date === todayIso) && <NowLine dates={[]} scale={scale} focus={office?.from} />}
        </DragSurface>
      </div>
      <Legend types={[...types, { label: t("surgery"), minutes: 0, color: "blue" }]}
        zones={{ flex: t("legend.flex"), closed: t("legend.closedShort"), extra: <><span>✓ {t("legend.confirmed")} · ? {t("legend.waiting")}</span>{resources.length > 1 && <span>{t("legend.lanes", { list: resources.map((r) => r.label).join(" | ") })}</span>}</> }} />
    </section>
  );
}

// Secretary month (DESIGN 6a–6f): availability map — green ≥ 2 h free, amber < 2 h, red
// full; holidays; past days; banner when new-patient slots are full for > 10 days.
export async function DeskMonth({ days: all, monthIso, todayIso, firstFree, weekend, carry }: { days: RangeDay[]; monthIso: string; todayIso: string; firstFree: { label: string; days: number } | null; weekend: boolean; carry?: string }) {
  const t = await getTranslations("calendar");
  // Mon–Fri (DESIGN 6a–6g); Sat/Sun only with «+ Σαβ/Κυρ».
  const days = weekend ? all : all.filter((d) => d.weekday <= 5);
  const weekdays = weekend ? [1, 2, 3, 4, 5, 6, 7] : [1, 2, 3, 4, 5];
  const grid = weekend ? "grid-cols-7" : "grid-cols-5";
  return (
    <div className="flex flex-col gap-4">
      {firstFree && firstFree.days > 10 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-warn-line bg-warn-bg px-4 py-3 text-sm text-warn-ink">
          <span><b>{t("fullBanner", { days: firstFree.days })}</b> {t("fullBannerText")}</span>
          <span>{t("firstFree")}: <b>{firstFree.label}</b></span>
        </div>
      )}
      <section className={`${card} overflow-hidden`}>
        <div className={`grid ${grid} border-b border-line-soft text-[13px] font-semibold text-muted`}>
          {weekdays.map((w) => <div key={w} className="px-3 py-2">{t(`weekdays.${w}`)}</div>)}
        </div>
        <div className={`grid ${grid}`}>
          {days.map((d) => {
            const inMonth = d.date.slice(0, 7) === monthIso.slice(0, 7);
            const past = d.date < todayIso;
            const free = Object.values(d.resources).reduce((n, r) => n + r.freeMinutes, 0);
            const open = Object.values(d.resources).some((r) => r.hours.length);
            const tone = !inMonth || past ? "bg-surface-2" : d.holiday ? "bg-line-softer" : !open ? "bg-surface" : free === 0 ? "bg-danger-bg/60" : free < 120 ? "bg-warn-bg/70" : "bg-ok-bg/60";
            // Surgery line (DESIGN 6a–6g month): how much of the window is left.
            const load = Object.values(d.resources).map((r) => r.load).find((l) => l && (l.window || l.ops));
            const chip = !load ? null : load.state === "over" ? "bg-danger-bg text-danger-ink" : ["full", "closes"].includes(load.state) ? "bg-cal-blue text-white" : load.state === "free" ? "bg-ok-bg text-ok-ink" : "bg-cal-blue-bg text-cal-blue";
            return (
              <Link key={d.date} href={`/calendar?date=${d.date}${carry ? `&carry=${carry}` : ""}${weekend ? "&we=1" : ""}`} className={`flex min-h-[104px] flex-col gap-1 border-b border-r border-line-softer px-3 py-2 hover:outline hover:outline-2 hover:outline-primary ${tone}`}>
                <span className={`self-start text-[14px] ${!inMonth ? "text-placeholder" : ""} ${d.date === todayIso ? "rounded-full bg-primary px-2 text-white" : ""}`}>{Number(d.date.slice(8))}</span>
                {inMonth && (
                  d.holiday ? <span className="rounded-[6px] bg-line px-2 py-0.5 text-[12px] font-semibold text-ink-3">{t("holidayShort")} · {d.holiday}</span>
                  : past ? <span className="text-[12.5px] text-muted">{t("past")}</span>
                  : (
                    <>
                      {load && <span className="flex items-center gap-1.5 text-[12.5px] text-ink-3">{t("surgeryShort")} <span className={`rounded-[5px] px-1.5 py-px text-[11.5px] font-semibold ${chip}`}>{t(`load.${load.state}`, { x: duration(load.remaining) })}</span></span>}
                      <span className="text-[12.5px] text-ink-3">{t("officeShort")} {open ? <b className={freeTone(free)}>{free === 0 ? t("load.full") : t("freeShort", { free: duration(free) })}</b> : <span className="text-muted">{t("closedShort")}</span>}</span>
                    </>
                  )
                )}
              </Link>
            );
          })}
        </div>
      </section>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-muted">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-[3px] bg-ok-bg" />{t("legend.enough")}</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-[3px] bg-warn-bg" />{t("legend.little")}</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-[3px] bg-danger-bg" />{t("legend.full")}</span>
        <span>{t("legend.normalOnly")}</span>
      </div>
    </div>
  );
}
