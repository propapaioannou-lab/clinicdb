import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { companies, ctx, makeActor, makePatient } from "../../../test/factories";
import { createAppointment } from "./appointments";
import { addBubble, bookBubble, bubbleCarry, listBubbles, removeBubble } from "./bubbles";
import { SPA_HOURS } from "./hours";

// Calendar v3: patients waiting on the calendar for a time (bubbles).

let c: { surgery: string; spa: string };
let doctor: string;
let botox: string;
const tag = () => Math.random().toString(36).slice(2, 7);

beforeAll(async () => {
  c = await companies();
  doctor = (await db.resource.create({ data: { companyId: c.surgery, kind: "DOCTOR", label: `Δρ bubble ${tag()}`, hours: SPA_HOURS } })).id;
  botox = (await db.appointmentType.create({ data: { companyId: c.surgery, labelEl: `Botox ${tag()}`, labelEn: "B", defaultMinutes: 10 } })).id;
  if (!(await db.appointmentType.count({ where: { companyId: c.surgery, forNewPatients: true, isActive: true } }))) {
    await db.appointmentType.create({ data: { companyId: c.surgery, labelEl: `Πρώτη ${tag()}`, labelEn: "F", defaultMinutes: 30, forNewPatients: true } });
  }
});

describe("bubbles", () => {
  it("a patient on file waits once (a second add updates the type), is seen by the desk, logged", async () => {
    const sec = await makeActor("USER", [c.surgery], "SECRETARY");
    const p = await makePatient(c.surgery, { surname: `Αναμ${tag()}`, firstName: "Ελένη" });
    const a = await addBubble(sec, c.surgery, { patientId: p.id }, ctx);
    const b = await addBubble(sec, c.surgery, { patientId: p.id, typeId: botox }, ctx);
    if (!a.ok || !b.ok) throw new Error("add");
    expect(b.id).toBe(a.id);
    const other = await makeActor("USER", [c.surgery], "SECRETARY");
    const mine = (await listBubbles(other, c.surgery))!.find((x) => x.id === a.id)!;
    expect([mine.name, mine.isNew, mine.typeId, mine.minutes, mine.by]).toEqual([`Ελένη ${p.surname}`, false, botox, 10, sec.name]);
    expect(await db.auditLog.count({ where: { entityId: p.id, action: { in: ["bubble.created", "bubble.updated"] } } })).toBe(2);
  });

  it("stays inside the company", async () => {
    const spaOnly = await makeActor("USER", [c.spa], "SECRETARY");
    const p = await makePatient(c.surgery, { surname: `Ξένη${tag()}`, firstName: "Άννα" });
    expect(await addBubble(spaOnly, c.surgery, { patientId: p.id }, ctx)).toMatchObject({ ok: false, error: "forbidden" });
    expect(await listBubbles(spaOnly, c.surgery)).toBeNull();
    const sec = await makeActor("USER", [c.surgery], "SECRETARY");
    const r = await addBubble(sec, c.surgery, { patientId: p.id }, ctx);
    if (!r.ok) throw new Error("add");
    expect(await removeBubble(spaOnly, r.id, ctx)).toMatchObject({ ok: false });
    expect(await bubbleCarry(spaOnly, r.id)).toBeNull();
  });

  it("a new patient is only a name until booked; booking creates the record and closes the bubble", async () => {
    const sec = await makeActor("USER", [c.surgery], "SECRETARY");
    const surname = `Νέα${tag()}`;
    const r = await addBubble(sec, c.surgery, { newPatient: { name: `Μαρία ${surname}`, mobile: "6912345678" } }, ctx);
    if (!r.ok) throw new Error("add");
    expect(await db.patient.count({ where: { companyId: c.surgery, surname } })).toBe(0);
    const carry = (await bubbleCarry(sec, r.id))!;
    expect(carry.who).toMatch(/^Μαρία Ν\. · /);
    const booked = await bookBubble(sec, r.id, { resourceId: doctor, date: "2030-05-06", time: "17:00" }, ctx);
    if (!booked.ok) throw new Error(JSON.stringify(booked));
    const p = await db.patient.findFirstOrThrow({ where: { companyId: c.surgery, surname }, include: { phones: true } });
    expect([p.firstName, p.tags, p.phones.length]).toEqual(["Μαρία", ["to_confirm"], 1]);
    const b = await db.calendarBubble.findUniqueOrThrow({ where: { id: r.id } });
    expect([b.closedWhy, b.appointmentId, b.patientId]).toEqual(["booked", booked.id, p.id]);
    expect((await listBubbles(sec, c.surgery))!.some((x) => x.id === r.id)).toBe(false);
  });

  it("a taken time is refused and the bubble keeps waiting; removing closes it (never deleted)", async () => {
    const sec = await makeActor("USER", [c.surgery], "SECRETARY");
    const p = await makePatient(c.surgery, { surname: `Πιασμ${tag()}`, firstName: "Γιώργος" });
    await createAppointment(sec, { typeId: botox, resourceId: doctor, date: "2030-05-07", time: "17:00", minutes: 60 }, ctx);
    const r = await addBubble(sec, c.surgery, { patientId: p.id, typeId: botox }, ctx);
    if (!r.ok) throw new Error("add");
    expect(await bookBubble(sec, r.id, { resourceId: doctor, date: "2030-05-07", time: "17:20" }, ctx)).toMatchObject({ ok: false, error: "clash" });
    expect((await db.calendarBubble.findUniqueOrThrow({ where: { id: r.id } })).closedAt).toBeNull();
    expect(await removeBubble(sec, r.id, ctx)).toEqual({ ok: true });
    expect((await db.calendarBubble.findUniqueOrThrow({ where: { id: r.id } })).closedWhy).toBe("removed");
    expect(await removeBubble(sec, r.id, ctx)).toMatchObject({ ok: false, error: "not_found" });
  });

  it("a new patient needs a name", async () => {
    const sec = await makeActor("USER", [c.surgery], "SECRETARY");
    expect(await addBubble(sec, c.surgery, { newPatient: { name: "   " } }, ctx)).toMatchObject({ ok: false, error: "invalid_value" });
  });
});
