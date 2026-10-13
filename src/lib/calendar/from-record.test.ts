import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { companies, ctx, makeActor, makePatient } from "../../../test/factories";
import { createAppointment } from "./appointments";
import { bookingFor, bookingMenu } from "./from-record";
import { SPA_HOURS } from "./hours";

// 6a-9: «+ Ραντεβού ▾» from the patient record.

let c: { surgery: string; spa: string };
let doctor: string;
const tag = () => Math.random().toString(36).slice(2, 7);

beforeAll(async () => {
  c = await companies();
  doctor = (await db.resource.create({ data: { companyId: c.surgery, kind: "DOCTOR", label: `Δρ rec ${tag()}`, hours: SPA_HOURS } })).id;
  if (!(await db.appointmentType.count({ where: { companyId: c.surgery, forNewPatients: true, isActive: true } }))) {
    await db.appointmentType.create({ data: { companyId: c.surgery, labelEl: `Πρώτη ${tag()}`, labelEn: "F", defaultMinutes: 30, forNewPatients: true } });
  }
  await db.appointmentType.create({ data: { companyId: c.surgery, labelEl: `Botox ${tag()}`, labelEn: "B", defaultMinutes: 10 } });
});

describe("booking from the record", () => {
  it("a patient never seen gets the new-patient type first; a known one does not", async () => {
    const fresh = await makePatient(c.surgery, { surname: `Νέα ${tag()}` });
    const menu = (await bookingMenu(c.surgery, fresh.id)).types;
    const firstIds = (await db.appointmentType.findMany({ where: { companyId: c.surgery, forNewPatients: true, isActive: true } })).map((x) => x.id);
    expect(firstIds.length).toBeGreaterThan(0);
    expect(firstIds).toContain(menu[0].id);
    const known = await makePatient(c.surgery, { surname: `Γνωστή ${tag()}` });
    await db.visit.create({ data: { companyId: c.surgery, patientId: known.id } });
    const menu2 = (await bookingMenu(c.surgery, known.id)).types;
    expect(menu2.some((x) => firstIds.includes(x.id))).toBe(false);
    expect(menu2.length).toBeGreaterThan(0);
  });

  it("shows an upcoming appointment; refuses other companies, archived patients and surgery types", async () => {
    const sec = await makeActor("USER", [c.surgery], "SECRETARY");
    const p = await makePatient(c.surgery, { surname: `Έχει ${tag()}` });
    const type = await db.appointmentType.create({ data: { companyId: c.surgery, labelEl: `Επαν ${tag()}`, labelEn: "F", defaultMinutes: 10 } });
    const r = await createAppointment(sec, { patientId: p.id, typeId: type.id, resourceId: doctor, date: "2030-07-01", time: "17:00" }, ctx);
    if (!r.ok) throw new Error(r.error);
    expect((await bookingMenu(c.surgery, p.id)).upcoming).toMatch(/1\/7.*17:00 · Επαν/);
    const b = await bookingFor(c.surgery, p.id, type.id);
    expect(b).toMatchObject({ patientId: p.id, minutes: 10, upcoming: expect.stringMatching(/17:00/) });
    expect(await bookingFor(c.spa, p.id, type.id)).toBeNull();
    const surgery = await db.appointmentType.create({ data: { companyId: c.surgery, labelEl: `Χειρ ${tag()}`, labelEn: "S", defaultMinutes: 120, layer: "SURGERY" } });
    expect(await bookingFor(c.surgery, p.id, surgery.id)).toBeNull();
    await db.patient.update({ where: { id: p.id }, data: { archivedAt: new Date() } });
    expect(await bookingFor(c.surgery, p.id, type.id)).toBeNull();
  });
});
