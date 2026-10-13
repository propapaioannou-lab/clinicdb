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
// Monday of the mockup week; the online demo passes the current Monday (FAKE_CALENDAR_WEEK).
const WEEK = process.env.FAKE_CALENDAR_WEEK ?? "2026-10-12";
const WEEKS = Number(process.env.FAKE_CALENDAR_WEEKS ?? 4);

// Office mix (type label → weight), as in the mockups: many short follow-ups and Botox.
const MIX: [string, number][] = [["Επανέλεγχος", 30], ["Botox", 15], ["Νέα συμβουλευτική", 18], ["Πρώτη επίσκεψη", 20], ["Προεγχειρητική", 10], ["Online", 7]];
const REASONS: Record<string, string[]> = {
  "Πρώτη επίσκεψη": ["Αυξητική μαστού", "Ρινοπλαστική", "Βλεφαροπλαστική", "Κοιλιοπλαστική", "Λιποαναρρόφηση"],
  "Νέα συμβουλευτική": ["Ουλή", "Σπίλος", "Μάστοπηξία", "Ωτοπλαστική"],
  "Προεγχειρητική": ["Αυξητική μαστού", "Ρινοπλαστική", "Κοιλιοπλαστική"],
  "Επανέλεγχος": ["1η εβδομάδα", "1 μήνας", "3 μήνες", "Ράμματα"],
};
// Surgeries per weekday of the mockup week (CalSecWeek): [start, minutes, procedure].
// Tuesday's 5 h 30′ case closes the day; Friday runs over 14:00.
const SURGERIES: Record<number, [string, number, string][]> = {
  1: [["07:30", 180, "Ρινοπλαστική"], ["11:00", 120, "Βλεφαροπλαστική"]],
  2: [["07:30", 330, "Lifting + βλεφαροπλαστική"]],
  3: [["07:30", 120, "Αυξητική μαστού"], ["10:00", 120, "Γυναικομαστία"]],
  4: [["07:30", 270, "Κοιλιοπλαστική + λίπο"]],
  5: [["07:30", 270, "Lifting (deep plane)"], ["12:30", 120, "Βλεφαροπλαστική"]],
};
// Later weeks: a lighter, random mix (month views).
const PROCEDURES: [string, number][] = [["Ρινοπλαστική", 180], ["Αυξητική μαστού", 120], ["Βλεφαροπλαστική", 120], ["Κοιλιοπλαστική", 240], ["Λιποαναρρόφηση", 150], ["Μαστοπηξία", 210], ["Γυναικομαστία", 120]];

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
        // Morning surgeries on the doctor's column (Phase 4 books them for real).
        const surgery = byLabel("Χειρουργείο");
        if (r.kind === "DOCTOR" && surgery && rules.surgery.length) {
          if (mockupWeek) {
            for (const [at, minutes, what] of SURGERIES[weekday] ?? []) await add(r.id, iso, Number(at.slice(0, 2)) * 60 + Number(at.slice(3)), minutes, surgery.id, what);
          } else if (rand() < 0.85) {
            const [what, minutes] = pick(PROCEDURES);
            await add(r.id, iso, rules.surgery[0].from, minutes, surgery.id, what);
            if (minutes <= 180 && rand() < 0.5) {
              const [w2, m2] = pick(PROCEDURES.filter((x) => x[1] <= 150));
              await add(r.id, iso, rules.surgery[0].from + minutes + 30, m2, surgery.id, w2);
            }
          }
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
    // A quickly booked new patient, as on the boards (6a-6): name only, «προς επιβεβαίωση»,
    // «χωρίς τηλέφωνο» — tomorrow's confirmations show her as «Δεν μπορεί να ειδοποιηθεί».
    const first = types.find((t) => t.forNewPatients);
    const doc = resources.find((r) => r.kind === "DOCTOR");
    if (company.code !== "spa" && first && doc) {
      let ioanna = await db.patient.findFirst({ where: { companyId: company.id, surname: "Ράπη", firstName: "Ιωάννα" } });
      if (!ioanna) {
        const max = await db.patient.aggregate({ where: { companyId: company.id }, _max: { number: true } });
        ioanna = await db.patient.create({ data: { companyId: company.id, number: (max._max.number ?? 0) + 1, surname: "Ράπη", firstName: "Ιωάννα", searchName: "rapi ioanna", sortName: "ΡΑΠΗ ΙΩΑΝΝΑ", tags: ["to_confirm", "no_phone"] } });
      } else await db.patient.update({ where: { id: ioanna.id }, data: { tags: ["to_confirm", "no_phone"] } });
      const [ty, tm, td] = addDays(WEEK, 1).split("-").map(Number); // Tuesday of the mockup week
      const startsAt = athensToUtc(ty, tm, td, 19, 0);
      const endsAt = new Date(startsAt.getTime() + first.defaultMinutes * 60e3);
      const over = await db.appointment.findMany({ where: { resourceId: doc.id, startsAt: { lt: endsAt }, endsAt: { gt: startsAt }, events: { some: { byName: "seed", action: "created" } } }, select: { id: true } });
      await db.appointmentEvent.deleteMany({ where: { appointmentId: { in: over.map((o) => o.id) } } });
      await db.appointment.deleteMany({ where: { id: { in: over.map((o) => o.id) } } });
      await db.appointment.create({
        data: { companyId: company.id, patientId: ioanna.id, typeId: first.id, resourceId: doc.id, startsAt, endsAt, status: "BOOKED", reason: "Βλεφαροπλαστική",
          events: { create: { companyId: company.id, action: "created", toStatus: "BOOKED", byName: "seed" } } },
      });
    }
    // Two fake people on the waiting list (6a-8), so a cancellation shows matches.
    if (company.code !== "spa") {
      await db.waitlistEntry.deleteMany({ where: { companyId: company.id, note: { startsWith: "Δοκιμή:" } } });
      const botox = byLabel("Botox");
      const recheck = byLabel("Επανέλεγχος");
      const [w1, w2] = [pick(patients), pick(patients)];
      await db.waitlistEntry.create({ data: { companyId: company.id, patientId: w1.id, typeId: botox?.id, days: [1, 2, 4], fromTime: "16:30", toTime: "20:00", note: "Δοκιμή: ό,τι πιο νωρίς" } });
      await db.waitlistEntry.create({ data: { companyId: company.id, patientId: w2.id, typeId: recheck?.id, days: [], note: "Δοκιμή: οποιαδήποτε ώρα" } });
    }
    console.log(`${company.code}: ${n} fake appointments`);
  }
}
main().finally(() => db.$disconnect());
