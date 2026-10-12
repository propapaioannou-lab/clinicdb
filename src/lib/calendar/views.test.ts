import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { athensToUtc } from "@/lib/time";
import { companies, ctx, makeActor, makePatient } from "../../../test/factories";
import { createAppointment } from "./appointments";
import { SPA_HOURS } from "./hours";
import { addDays, calendarRange, mondayOf } from "./views";

let c: { surgery: string; spa: string };
let doctor: string;
let type: string;
const tag = () => Math.random().toString(36).slice(2, 7);
beforeAll(async () => {
  c = await companies();
  doctor = (await db.resource.create({ data: { companyId: c.surgery, kind: "DOCTOR", label: `Δρ ${tag()}`, hours: SPA_HOURS } })).id;
  type = (await db.appointmentType.create({ data: { companyId: c.surgery, labelEl: `Τύπος ${tag()}`, labelEn: "T", defaultMinutes: 30 } })).id;
});

describe("week and month data", () => {
  it("dates: Monday of a week, adding days", () => {
    expect(mondayOf("2030-03-07")).toBe("2030-03-04");
    expect(mondayOf("2030-03-10")).toBe("2030-03-04"); // Sunday belongs to the week before
    expect(addDays("2030-02-27", 3)).toBe("2030-03-02");
  });

  it("free time per day, holidays, and who is a new patient", async () => {
    const sec = await makeActor("USER", [c.surgery], "SECRETARY");
    const p = await makePatient(c.surgery, { surname: `Νέος ${tag()}` });
    await createAppointment(sec, { patientId: p.id, typeId: type, resourceId: doctor, date: "2030-03-04", time: "09:00" }, ctx);
    await createAppointment(sec, { patientId: p.id, typeId: type, resourceId: doctor, date: "2030-03-05", time: "09:00" }, ctx);
    const days = (await calendarRange(sec, c.surgery, "2030-03-04", 8, [doctor]))!;
    // Mon: 5h + 4h of hours minus 30′ booked; Clean Monday 2030 is 11/3, not in range.
    expect(days[0].resources[doctor].freeMinutes).toBe(9 * 60 - 30);
    expect(days[5].resources[doctor].hours).toEqual([]); // Saturday closed
    expect(days[0].appointments[0]).toMatchObject({ time: "09:00", isNew: true });
    expect(days[1].appointments[0]).toMatchObject({ isNew: false }); // second time: not new
    await db.visit.create({ data: { companyId: c.surgery, patientId: p.id, startedAt: athensToUtc(2029, 1, 1, 10, 0) } });
    expect((await calendarRange(sec, c.surgery, "2030-03-04", 1, [doctor]))![0].appointments[0].isNew).toBe(false); // visited before
    expect(await calendarRange(await makeActor("GUEST", [c.surgery]), c.surgery, "2030-03-04", 1, [doctor])).toBeNull();
    const holiday = (await calendarRange(sec, c.surgery, "2030-03-11", 1, [doctor]))![0];
    expect([holiday.holiday, holiday.resources[doctor].hours]).toEqual(["Καθαρά Δευτέρα", []]);
  });
});
