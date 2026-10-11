import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { card } from "@/components/ui";
import { calColor } from "@/lib/calendar/colors";
import type { RangeDay } from "@/lib/calendar/views";

const PX = 52; // secretary week: compact grid (DESIGN 6a–6f)
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const duration = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}ω${min % 60 ? ` ${min % 60}′` : ""}` : `${min}′`);
const dayName = new Intl.DateTimeFormat("el-GR", { weekday: "short", day: "numeric", timeZone: "UTC" });
const freeTone = (min: number) => (min === 0 ? "text-danger-ink" : min < 120 ? "text-warn-ink" : "text-ok-ink");

// Secretary week (DESIGN 6a–6f): Mon–Sat, one line per appointment with ✓ / ?, out of
// hours grey, "ελεύθερα" per day; the nurse column on demand.
export async function DeskWeek({ days, resources, todayIso }: { days: RangeDay[]; resources: { id: string; label: string }[]; todayIso: string }) {
  const t = await getTranslations("calendar");
  const all = days.flatMap((d) => [...Object.values(d.resources).flatMap((r) => r.hours.flatMap((h) => [h.from, h.to])), ...d.appointments.flatMap((a) => [a.start, a.end])]);
  const startHour = all.length ? Math.min(9, Math.floor(Math.min(...all) / 60)) : 9;
  const endHour = all.length ? Math.max(startHour + 8, Math.ceil(Math.max(...all) / 60)) : 21;
  const top = (min: number) => ((min - startHour * 60) / 60) * PX;
  const lanes = resources.length;
  return (
    <section className={`${card} overflow-hidden`}>
      <div className="grid border-b border-line-soft" style={{ gridTemplateColumns: `52px repeat(${days.length}, minmax(0, 1fr))` }}>
        <span />
        {days.map((d) => {
          const free = Object.values(d.resources).reduce((n, r) => n + r.freeMinutes, 0);
          const open = Object.values(d.resources).some((r) => r.hours.length);
          return (
            <Link key={d.date} href={`/calendar?date=${d.date}`} className={`border-l border-line-soft px-3 py-2 hover:bg-surface-2 ${d.date === todayIso ? "bg-primary-tint" : ""}`}>
              <div className="text-[15px] font-semibold first-letter:uppercase">{dayName.format(new Date(`${d.date}T12:00:00Z`))}{d.date === todayIso && <span className="ml-1 text-[12px] font-semibold text-primary">{t("todayShort")}</span>}</div>
              <div className={`text-[12.5px] font-semibold ${d.holiday || !open ? "text-muted" : freeTone(free)}`}>{d.holiday ?? (open ? t("freeShort", { free: duration(free) }) : t("closed"))}</div>
            </Link>
          );
        })}
      </div>
      <div className="max-h-[calc(100vh-260px)] overflow-y-auto">
        <div className="relative grid" style={{ gridTemplateColumns: `52px repeat(${days.length}, minmax(0, 1fr))`, height: (endHour - startHour) * PX }}>
          <div className="relative">
            {Array.from({ length: endHour - startHour }, (_, i) => <span key={i} className="absolute right-1.5 text-[11.5px] text-muted" style={{ top: i * PX - 7 }}>{hhmm((startHour + i) * 60)}</span>)}
          </div>
          {days.map((d) => (
            <div key={d.date} className="relative grid border-l border-line-soft" style={{ gridTemplateColumns: `repeat(${lanes}, minmax(0, 1fr))` }}>
              {resources.map((r, li) => {
                const rr = d.resources[r.id];
                return (
                  <div key={r.id} className={`relative ${li ? "border-l border-dashed border-line-soft" : ""}`}>
                    <div className="absolute inset-0 bg-line-softer/60" />
                    {rr?.hours.map((h) => <div key={h.from} className="absolute left-0 right-0 bg-surface" style={{ top: top(h.from), height: top(h.to) - top(h.from) }} />)}
                    {rr?.blocks.map((b, i) => (
                      <div key={i} className="absolute left-0.5 right-0.5 overflow-hidden rounded-[6px] bg-[repeating-linear-gradient(45deg,var(--color-line-softer)_0_6px,var(--color-line)_6px_8px)] px-1.5 text-[11px] text-ink-3" style={{ top: top(b.start), height: top(b.end) - top(b.start) }}>
                        {b.label ?? t(`blockKinds.${b.kind}`)}
                      </div>
                    ))}
                    {d.appointments.filter((a) => a.resourceId === r.id).map((a) => (
                      <Link key={a.id} href={`/calendar?date=${d.date}`}
                        className={`absolute left-0.5 right-0.5 flex items-start justify-between gap-1 overflow-hidden rounded-[6px] px-1.5 text-[11.5px] leading-[17px] ${calColor(a.color).box} ${!a.active ? "line-through opacity-50" : a.status === "DONE" ? "opacity-60" : ""}`}
                        style={{ top: top(a.start) + 1, height: Math.max(17, top(a.end) - top(a.start) - 2), zIndex: 2 }}>
                        <span className="truncate"><b>{a.time}</b> {a.name ?? a.typeLabel}</span>
                        <span className="shrink-0">{a.status === "BOOKED" ? "?" : a.active ? "✓" : ""}</span>
                      </Link>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line-soft px-4 py-2.5 text-[12.5px] text-muted">
        <span>✓ {t("legend.confirmed")}</span><span>? {t("legend.waiting")}</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-[3px] bg-line-softer" />{t("legend.outOfHours")}</span>
        {resources.length > 1 && <span>{t("legend.lanes", { list: resources.map((r) => r.label).join(" | ") })}</span>}
      </div>
    </section>
  );
}

// Secretary month (DESIGN 6a–6f): availability map — green ≥ 2 h free, amber < 2 h, red
// full; holidays; past days; banner when new-patient slots are full for > 10 days.
export async function DeskMonth({ days, monthIso, todayIso, firstFree }: { days: RangeDay[]; monthIso: string; todayIso: string; firstFree: { label: string; days: number } | null }) {
  const t = await getTranslations("calendar");
  const weekdays = [1, 2, 3, 4, 5, 6, 7];
  return (
    <div className="flex flex-col gap-4">
      {firstFree && firstFree.days > 10 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-warn-line bg-warn-bg px-4 py-3 text-sm text-warn-ink">
          <span><b>{t("fullBanner", { days: firstFree.days })}</b> {t("fullBannerText")}</span>
          <span>{t("firstFree")}: <b>{firstFree.label}</b></span>
        </div>
      )}
      <section className={`${card} overflow-hidden`}>
        <div className="grid grid-cols-7 border-b border-line-soft text-[13px] font-semibold text-muted">
          {weekdays.map((w) => <div key={w} className="px-3 py-2">{t(`weekdays.${w}`)}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d) => {
            const inMonth = d.date.slice(0, 7) === monthIso.slice(0, 7);
            const past = d.date < todayIso;
            const free = Object.values(d.resources).reduce((n, r) => n + r.freeMinutes, 0);
            const open = Object.values(d.resources).some((r) => r.hours.length);
            const tone = !inMonth || past || !open ? "bg-surface-2" : d.holiday ? "bg-line-softer" : free === 0 ? "bg-danger-bg/60" : free < 120 ? "bg-warn-bg/70" : "bg-ok-bg/60";
            return (
              <Link key={d.date} href={`/calendar?date=${d.date}`} className={`flex min-h-[104px] flex-col gap-1 border-b border-r border-line-softer px-3 py-2 hover:outline hover:outline-2 hover:outline-primary ${tone}`}>
                <span className={`self-start text-[14px] ${!inMonth ? "text-placeholder" : ""} ${d.date === todayIso ? "rounded-full bg-primary px-2 text-white" : ""}`}>{Number(d.date.slice(8))}</span>
                {inMonth && (
                  d.holiday ? <span className="rounded-[6px] bg-line px-2 py-0.5 text-[12px] font-semibold text-ink-3">{t("holidayShort")} · {d.holiday}</span>
                  : past ? <span className="text-[12.5px] text-muted">{t("past")}</span>
                  : !open ? null
                  : <span className={`text-[13px] font-semibold ${freeTone(free)}`}>{free === 0 ? t("full") : t("freeShort", { free: duration(free) })}</span>
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
        <span>{t("legend.surgeriesLater")}</span>
      </div>
    </div>
  );
}
