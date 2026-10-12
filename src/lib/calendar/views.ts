import { db } from "@/lib/db";
import type { Actor } from "@/lib/users/manage";
import { athensIsoDate, athensParts, athensToUtc } from "@/lib/time";
import { canEditPatients } from "@/lib/permissions";
import { holidayOn } from "./holidays";
import { buildScale, type Scale } from "./bands";
import { surgeryLoad, type SurgeryLoad } from "./capacity";
import { calendarConfigOf } from "./config";
import { dayRules, hoursOf } from "./hours";
import { ACTIVE_STATUSES } from "./status";

// Week and month views (Phase 6a-3, DESIGN 6a–6f): a range of days for some resources,
// worked out from two queries. Minutes are from Athens midnight.

export type RangeAppointment = {
  id: string;
  resourceId: string;
  day: string;
  start: number;
  end: number;
  time: string;
  name: string | null;
  patientId: string | null;
  typeLabel: string;
  color: string;
  layer: string;
  reason: string | null;
  status: string;
  room: string | null;
  active: boolean;
  isNew: boolean;
};
export type RangeDay = {
  date: string;
  weekday: number; // Mon=1 … Sun=7
  holiday: string | null;
  resources: Record<string, { hours: { from: number; to: number }[]; flex: { from: number; to: number }[]; surgery: { from: number; to: number }[]; blocks: { start: number; end: number; label: string | null; kind: string }[]; freeMinutes: number; load: SurgeryLoad | null }>;
  appointments: RangeAppointment[];
};

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const clock = (d: Date) => {
  const p = athensParts(d);
  return p.hour * 60 + p.minute;
};

export function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
// Monday of the week that contains `iso`.
export function mondayOf(iso: string) {
  const wd = new Date(`${iso}T12:00:00Z`).getUTCDay() || 7;
  return addDays(iso, 1 - wd);
}

export async function calendarRange(actor: Actor, companyId: string, fromIso: string, days: number, resourceIds: string[]): Promise<RangeDay[] | null> {
  if (!canEditPatients(actor.level) || !actor.companyIds.includes(companyId)) return null;
  const [y, m, d] = fromIso.split("-").map(Number);
  const from = athensToUtc(y, m, d);
  const to = athensToUtc(y, m, d + days);
  const [resources, appts, blocks, cfg] = await Promise.all([
    db.resource.findMany({ where: { companyId, id: { in: resourceIds } } }),
    db.appointment.findMany({
      where: { companyId, resourceId: { in: resourceIds }, startsAt: { lt: to }, endsAt: { gt: from } },
      orderBy: { startsAt: "asc" },
      include: { patient: { select: { id: true, surname: true, firstName: true } }, type: { select: { labelEl: true, color: true, layer: true } } },
    }),
    db.calendarBlock.findMany({ where: { companyId, startsAt: { lt: to }, endsAt: { gt: from }, OR: [{ resourceId: null }, { resourceId: { in: resourceIds } }] } }),
    calendarConfigOf(companyId),
  ]);
  // "New patient": no visit and no earlier (kept) appointment before this one.
  const patientIds = [...new Set(appts.flatMap((a) => (a.patientId ? [a.patientId] : [])))];
  const [firstVisits, firstAppts] = await Promise.all([
    db.visit.groupBy({ by: ["patientId"], where: { patientId: { in: patientIds } }, _min: { startedAt: true } }),
    db.appointment.groupBy({ by: ["patientId"], where: { patientId: { in: patientIds }, status: { in: ACTIVE_STATUSES } }, _min: { startsAt: true } }),
  ]);
  const firstVisit = new Map(firstVisits.map((v) => [v.patientId, v._min.startedAt]));
  const firstAppt = new Map(firstAppts.map((v) => [v.patientId as string, v._min.startsAt]));

  const out: RangeDay[] = [];
  for (let i = 0; i < days; i++) {
    const iso = addDays(fromIso, i);
    const dayStart = athensToUtc(y, m, d + i);
    const dayEnd = athensToUtc(y, m, d + i + 1);
    const weekday = athensParts(dayStart).weekday || 7;
    const holiday = holidayOn(iso) ?? null;
    const minuteIn = (t: Date) => (t <= dayStart ? 0 : t >= dayEnd ? 24 * 60 : clock(t));
    const todays = appts.filter((a) => a.startsAt < dayEnd && a.endsAt > dayStart);
    const rs: RangeDay["resources"] = {};
    for (const r of resources) {
      // Free time counts normal hours only (never the flex zones).
      const rules = dayRules(hoursOf(r.hours), cfg, weekday, { surgeryWindow: r.kind === "DOCTOR" });
      const hours = holiday ? [] : rules.normal;
      const myBlocks = blocks
        .filter((b) => (!b.resourceId || b.resourceId === r.id) && b.startsAt < dayEnd && b.endsAt > dayStart)
        .map((b) => ({ start: minuteIn(b.startsAt), end: minuteIn(b.endsAt), label: b.label, kind: b.kind }));
      const busy = [...todays.filter((a) => a.resourceId === r.id && ACTIVE_STATUSES.includes(a.status)).map((a) => [minuteIn(a.startsAt), minuteIn(a.endsAt)] as const), ...myBlocks.map((b) => [b.start, b.end] as const)].sort((a, b) => a[0] - b[0]);
      let free = 0;
      for (const h of hours) {
        let cur = h.from;
        for (const [s, e] of busy) {
          if (e <= cur || s >= h.to) continue;
          if (s > cur && s - cur >= 15) free += Math.min(s, h.to) - cur;
          cur = Math.max(cur, e);
        }
        if (h.to - cur >= 15) free += h.to - cur;
      }
      // Surgery-time bar (DESIGN 6a–6g): the cases of this column that day against the window.
      const cases = todays.filter((a) => a.resourceId === r.id && a.type.layer === "SURGERY" && ACTIVE_STATUSES.includes(a.status)).map((a) => ({ from: minuteIn(a.startsAt), to: minuteIn(a.endsAt) }));
      const load = r.kind === "DOCTOR" ? surgeryLoad(cases, holiday ? [] : rules.surgery) : null;
      rs[r.id] = { hours, flex: holiday ? [] : rules.flex, surgery: rules.surgery, blocks: myBlocks, freeMinutes: free, load };
    }
    out.push({
      date: iso,
      weekday,
      holiday,
      resources: rs,
      appointments: todays.map((a) => ({
        id: a.id,
        resourceId: a.resourceId,
        day: athensIsoDate(a.startsAt),
        start: minuteIn(a.startsAt),
        end: minuteIn(a.endsAt),
        time: hhmm(clock(a.startsAt)),
        name: a.patient ? `${a.patient.firstName ? `${a.patient.firstName} ` : ""}${a.patient.surname.slice(0, 1)}.` : null,
        patientId: a.patientId,
        typeLabel: a.type.labelEl,
        color: a.type.color,
        layer: a.type.layer,
        reason: a.reason,
        status: a.status,
        room: a.room,
        active: ACTIVE_STATUSES.includes(a.status),
        isNew: !!a.patientId && !(firstVisit.get(a.patientId) && firstVisit.get(a.patientId)! < a.startsAt) && firstAppt.get(a.patientId)?.getTime() === a.startsAt.getTime(),
      })),
    });
  }
  return out;
}

// The surgeon's own column: the doctor resource linked to them, else the first doctor.
export async function ownResource(actor: Actor, companyId: string) {
  return (
    (await db.resource.findFirst({ where: { companyId, isActive: true, userId: actor.id } })) ??
    (await db.resource.findFirst({ where: { companyId, isActive: true, kind: "DOCTOR" }, orderBy: { sortOrder: "asc" } }))
  );
}

// The physician's "Επόμενος" card: alerts only (flag, high-risk reasons, history state) —
// the same things shown in patient lists; the record itself opens with "Άνοιγμα καρτέλας".
export async function patientCard(companyId: string, patientId: string) {
  const p = await db.patient.findFirst({
    where: { id: patientId, companyId },
    select: {
      id: true, surname: true, firstName: true, birthDate: true, flag: true, riskFactors: true, infectiousDiseases: true,
      flagReasons: { select: { listItem: { select: { label: true } } } },
      history: { select: { status: true } },
    },
  });
  if (!p) return null;
  const now = new Date();
  const age = p.birthDate ? now.getUTCFullYear() - p.birthDate.getUTCFullYear() - (now < new Date(Date.UTC(now.getUTCFullYear(), p.birthDate.getUTCMonth(), p.birthDate.getUTCDate())) ? 1 : 0) : null;
  return {
    id: p.id,
    name: `${p.firstName} ${p.surname}`.trim(),
    age,
    flag: p.flag,
    flagReasons: p.flagReasons.map((f) => f.listItem.label),
    riskFactors: p.riskFactors,
    infectious: !!p.infectiousDiseases,
    history: p.history?.status ?? null,
  };
}

// Columns whose "ready" patients concern this surgeon: those linked to them; if no column
// is linked to anyone, every doctor column (single-surgeon practice).
export async function surgeonResources(userId: string, companyId: string) {
  const linked = await db.resource.findMany({ where: { companyId, isActive: true, userId }, select: { id: true } });
  if (linked.length) return linked.map((r) => r.id);
  const anyLinked = await db.resource.count({ where: { companyId, isActive: true, kind: "DOCTOR", userId: { not: null } } });
  if (anyLinked) return [];
  return (await db.resource.findMany({ where: { companyId, isActive: true, kind: "DOCTOR" }, select: { id: true } })).map((r) => r.id);
}

// The two-band scale of a week (DESIGN 6a–6g): every weekday's surgery window and office
// hours (+ flex) of the columns shown, widened to what is booked.
export function rangeScale(days: RangeDay[], resourceIds: string[]): Scale {
  const pick = (k: "hours" | "flex" | "surgery") => days.flatMap((d) => resourceIds.flatMap((id) => d.resources[id]?.[k] ?? []));
  const items = days.flatMap((d) => d.appointments.filter((a) => a.active && resourceIds.includes(a.resourceId)).map((a) => ({ from: a.start, to: a.end })));
  return buildScale({ surgery: pick("surgery"), office: [...pick("hours"), ...pick("flex")], items }, "week");
}
