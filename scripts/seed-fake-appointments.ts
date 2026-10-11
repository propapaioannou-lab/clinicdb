// FAKE appointments for development: fills the next 14 days of each company's calendar
// with fake patients, so the calendar screens can be tried. Never run on the real server.
//   npm run db:fake-calendar
import { db } from "../src/lib/db";
import { hoursOf, minutesOf } from "../src/lib/calendar/hours";
import { holidayOn } from "../src/lib/calendar/holidays";
import { athensIsoDate, athensParts, athensToUtc } from "../src/lib/time";

let seed = 7;
const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to add fake appointments in production.");
  for (const company of await db.company.findMany()) {
    const [types, resources, patients] = await Promise.all([
      db.appointmentType.findMany({ where: { companyId: company.id, isActive: true, NOT: { layer: "SURGERY" } } }),
      db.resource.findMany({ where: { companyId: company.id, isActive: true, NOT: { kind: "OPERATING_ROOM" } } }),
      db.patient.findMany({ where: { companyId: company.id, archivedAt: null }, select: { id: true }, take: 400 }),
    ]);
    if (!types.length || !resources.length || !patients.length) continue;
    const now = new Date();
    const today = athensParts(now);
    let n = 0;
    for (let d = 0; d < 14; d++) {
      const day = athensToUtc(today.year, today.month, today.day + d);
      if (holidayOn(athensIsoDate(day))) continue;
      const p = athensParts(day);
      for (const r of resources) {
        for (const h of hoursOf(r.hours).filter((x) => x.day === (p.weekday || 7))) {
          let m = minutesOf(h.from);
          while (m < minutesOf(h.to)) {
            const type = types[Math.floor(rand() * types.length)];
            const len = type.defaultMinutes;
            if (m + len > minutesOf(h.to)) break;
            if (rand() < 0.55) {
              const startsAt = athensToUtc(p.year, p.month, p.day, Math.floor(m / 60), m % 60);
              const past = startsAt < now;
              const status = past ? (rand() < 0.9 ? "DONE" : "NO_SHOW") : rand() < 0.6 ? "CONFIRMED" : "BOOKED";
              await db.appointment.create({
                data: {
                  companyId: company.id, patientId: patients[Math.floor(rand() * patients.length)].id, typeId: type.id, resourceId: r.id,
                  startsAt, endsAt: new Date(startsAt.getTime() + len * 60e3), status, reason: rand() < 0.4 ? "Δοκιμαστικό" : null,
                  events: { create: { companyId: company.id, action: "created", toStatus: "BOOKED", byName: "seed" } },
                },
              });
              n++;
            }
            m += len + (rand() < 0.3 ? 15 : 0);
          }
        }
      }
    }
    console.log(`${company.code}: ${n} fake appointments`);
  }
}
main().finally(() => db.$disconnect());
