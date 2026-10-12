// FAKE appointments for development (calendar v2, DESIGN 6a–6g): the week of 12–16 Oct 2026
// drawn like the mockups — surgeries in the morning window, a full office on Mon/Tue/Thu
// 16:30–20:00 with 10′ follow-ups and Botox, a couple of «εκτός ωραρίου +30′» bookings —
// then a lighter fill for the next three weeks (month view). Fake patients only.
// Re-running replaces what this script made before; appointments made by hand are kept.
// Never run on the real server.
//   npm run db:fake-calendar
import { db } from "../src/lib/db";
import { calendarConfigOf } from "../src/lib/calendar/config";
import { dayRules, hoursOf } from "../src/lib/calendar/hours";
import { holidayOn } from "../src/lib/calendar/holidays";
import { athensToUtc } from "../src/lib/time";

let seed = 7;
const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
const WEEK = "2026-10-12"; // Monday of the mockup week
const WEEKS = 4;

// Office mix (type label → weight), as in the mockups: many short follow-ups and Botox.
const MIX: [string, number][] = [["Επανέλεγχος", 30], ["Botox", 15], ["Νέα συμβουλευτική", 18], ["Πρώτη επίσκεψη", 20], ["Προεγχειρητική", 10], ["Online", 7]];
const REASONS: Record<string, string[]> = {
  "Πρώτη επίσκεψη": ["Αυξητική μαστού", "Ρινοπλαστική", "Βλεφαροπλαστική", "Κοιλιοπλαστική", "Λιποαναρρόφηση"],
  "Νέα συμβουλευτική": ["Ουλή", "Σπίλος", "Μάστοπηξία", "Ωτοπλαστική"],
  "Προεγχειρητική": ["Αυξητική μαστού", "Ρινοπλαστική", "Κοιλιοπλαστική"],
  "Επανέλεγχος": ["1η εβδομάδα", "1 μήνας", "3 μήνες", "Ράμματα"],
};
// Surgeries per weekday of the mockup week: [start, minutes, procedure]. Friday runs over 14:00.
const SURGERIES: Record<number, [string, number, string][]> = {
  1: [["08:00", 150, "Αυξητική μαστού"], ["11:00", 120, "Ρινοπλαστική"]],
  2: [["08:00", 240, "Κοιλιοπλαστική"]],
  3: [["08:00", 90, "Βλεφαροπλαστική"], ["10:00", 210, "Μαστοπηξία"]],
  4: [["08:00", 120, "Λιποαναρρόφηση"], ["10:30", 60, "Αφαίρεση σπίλων"]],
  5: [["08:00", 390, "Lifting προσώπου"]],
};

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to add fake appointments in production.");
  // What this script made before (and only that).
  const old = await db.appointment.findMany({ where: { events: { some: { action: "created", byName: "seed" } } }, select: { id: true } });
  await db.appointmentEvent.deleteMany({ where: { appointmentId: { in: old.map((a) => a.id) } } });
  await db.appointment.deleteMany({ where: { id: { in: old.map((a) => a.id) } } });
  console.log(`removed ${old.length} earlier fake appointments`);

  const now = new Date();
  for (const company of await db.company.findMany()) {
    const [types, resources, patients, cfg] = await Promise.all([
      db.appointmentType.findMany({ where: { companyId: company.id, isActive: true } }),
      db.resource.findMany({ where: { companyId: company.id, isActive: true, kind: { notIn: ["OPERATING_ROOM", "ROOM"] } }, orderBy: { sortOrder: "asc" } }),
      db.patient.findMany({ where: { companyId: company.id, archivedAt: null }, select: { id: true }, take: 400 }),
      calendarConfigOf(company.id),
    ]);
    if (!types.length || !resources.length || !patients.length) continue;
    const byLabel = (l: string) => types.find((t) => t.labelEl === l);
    const office = MIX.filter(([l]) => byLabel(l));
    const total = office.reduce((n, [, w]) => n + w, 0);
    const officeType = () => {
      if (!office.length) return pick(types.filter((t) => t.layer !== "SURGERY"));
      let r = rand() * total;
      for (const [l, w] of office) if ((r -= w) < 0) return byLabel(l)!;
      return byLabel(office[0][0])!;
    };
    let n = 0;
    const add = async (resourceId: string, iso: string, startMin: number, minutes: number, typeId: string, reason: string | null, extra: Record<string, unknown> = {}) => {
      const [y, m, d] = iso.split("-").map(Number);
      const startsAt = athensToUtc(y, m, d, Math.floor(startMin / 60), startMin % 60);
      const endsAt = new Date(startsAt.getTime() + minutes * 60e3);
      const past = endsAt < now;
      const status = past ? (rand() < 0.93 ? "DONE" : "NO_SHOW") : rand() < 0.6 ? "CONFIRMED" : "BOOKED";
      await db.appointment.create({
        data: {
          companyId: company.id, patientId: pick(patients).id, typeId, resourceId, startsAt, endsAt, status, reason,
          ...(status === "CONFIRMED" && { confirmedAt: now, confirmChannel: "staff" }),
          events: { create: { companyId: company.id, action: "created", toStatus: "BOOKED", byName: "seed", details: extra as object } },
        },
      });
      n++;
    };

    for (let day = 0; day < WEEKS * 7; day++) {
      const iso = addDays(WEEK, day);
      const weekday = new Date(`${iso}T12:00:00Z`).getUTCDay() || 7;
      if (weekday > 5 || holidayOn(iso)) continue;
      const mockupWeek = day < 7;
      for (const r of resources) {
        const rules = dayRules(hoursOf(r.hours), cfg, weekday, { surgeryWindow: r.kind === "DOCTOR" });
        // Morning surgeries on the doctor's column (the mockup week only; Phase 4 books them).
        const surgery = byLabel("Χειρουργείο");
        if (mockupWeek && r.kind === "DOCTOR" && surgery && rules.surgery.length) {
          for (const [at, minutes, what] of SURGERIES[weekday] ?? []) await add(r.id, iso, Number(at.slice(0, 2)) * 60 + Number(at.slice(3)), minutes, surgery.id, what);
        }
        // Office hours: packed in the mockup week, about half full after it. The nurse
        // column only gets a few follow-ups.
        const fill = r.kind === "NURSE" ? 0.15 : mockupWeek ? 0.88 : 0.5;
        for (const h of rules.normal) {
          let m = h.from;
          while (m < h.to) {
            const type = r.kind === "NURSE" ? (byLabel("Επανέλεγχος") ?? officeType()) : officeType();
            const len = type.defaultMinutes;
            if (m + len > h.to) break;
            if (rand() < fill) await add(r.id, iso, m, len, type.id, rand() < 0.75 ? pick(REASONS[type.labelEl] ?? [""]) || null : null);
            m += len + (rand() < 0.12 ? 5 : 0);
          }
        }
        // «Εκτός ωραρίου +30′»: one before and one after hours in the mockup week.
        if (mockupWeek && r.kind === "DOCTOR" && rules.flex.length && (weekday === 1 || weekday === 4)) {
          const f = weekday === 1 ? rules.flex[0] : rules.flex[rules.flex.length - 1];
          const t = byLabel(weekday === 1 ? "Επανέλεγχος" : "Botox") ?? officeType();
          await add(r.id, iso, weekday === 1 ? f.to - 20 : f.from + 5, t.defaultMinutes, t.id, weekday === 1 ? "Ράμματα" : null, { override: ["flex"] });
        }
      }
    }
    console.log(`${company.code}: ${n} fake appointments`);
  }
}
main().finally(() => db.$disconnect());
