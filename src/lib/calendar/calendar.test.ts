import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { athensToUtc } from "@/lib/time";
import { companies, ctx, makeActor, makePatient } from "../../../test/factories";
import { createVisit, setVisitClosed } from "@/lib/visits/visits";
import { greetingFor } from "@/lib/home/greeting";
import { calendarDay } from "./day";
import { createAppointment, freeSlots, linkVisit, moveAppointment, setAppointmentStatus, startVisit } from "./appointments";
import { greekHolidays, holidayOn, orthodoxEaster } from "./holidays";
import { checkTransition } from "./status";

let c: { surgery: string; spa: string };
let doctor: string;
let nurse: string;
let first: string;
const tag = () => Math.random().toString(36).slice(2, 7);
// A Monday far in the future (no "past" problems): 2030-03-04.
const MON = "2030-03-04";

beforeAll(async () => {
  c = await companies();
  doctor = (await db.resource.create({ data: { companyId: c.surgery, kind: "DOCTOR", label: `Δρ ${tag()}` } })).id;
  nurse = (await db.resource.create({ data: { companyId: c.surgery, kind: "NURSE", label: `Νοσηλεύτρια ${tag()}` } })).id;
  first = (await db.appointmentType.create({ data: { companyId: c.surgery, labelEl: `Πρώτη ${tag()}`, labelEn: "First", defaultMinutes: 30 } })).id;
});

describe("Greek public holidays", () => {
  it("Orthodox Easter and the holidays that move with it", () => {
    expect(orthodoxEaster(2025)).toEqual({ month: 4, day: 20 });
    expect(orthodoxEaster(2026)).toEqual({ month: 4, day: 12 });
    expect(orthodoxEaster(2027)).toEqual({ month: 5, day: 2 });
    expect(holidayOn("2026-02-23")).toBe("Καθαρά Δευτέρα");
    expect(holidayOn("2026-04-10")).toBe("Μεγάλη Παρασκευή");
    expect(holidayOn("2026-04-13")).toBe("Δευτέρα του Πάσχα");
    expect(holidayOn("2026-06-01")).toBe("Αγίου Πνεύματος");
    expect(holidayOn("2026-10-28")).toBe("28η Οκτωβρίου");
    expect(holidayOn("2026-10-29")).toBeUndefined();
    expect(greekHolidays(2026)).toHaveLength(13);
  });
});

describe("booking", () => {
  it("books a 30′ first visit; a clash is refused with the next free slots; override is logged", async () => {
    const sec = await makeActor("USER", [c.surgery], "SECRETARY");
    const p = await makePatient(c.surgery, { surname: `Ραντεβού ${tag()}` });
    const r = await createAppointment(sec, { patientId: p.id, typeId: first, resourceId: doctor, date: MON, time: "10:00" }, ctx);
    if (!r.ok) throw new Error(r.error);
    const a = await db.appointment.findUniqueOrThrow({ where: { id: r.id } });
    expect(a.endsAt.getTime() - a.startsAt.getTime()).toBe(30 * 60e3);
    expect(a.startsAt).toEqual(athensToUtc(2030, 3, 4, 10, 0));

    const p2 = await makePatient(c.surgery, { surname: `Δεύτερος ${tag()}` });
    const clash = await createAppointment(sec, { patientId: p2.id, typeId: first, resourceId: doctor, date: MON, time: "10:15" }, ctx);
    expect(clash).toMatchObject({ ok: false, error: "clash" });
    if (clash.ok) throw new Error("expected clash");
    expect(clash.problems?.map((x) => x.kind)).toEqual(["appointment"]);
    // 10:15 overlaps 10:00–10:30, so the first free start is 10:30.
    expect(clash.suggestions?.[0]).toEqual(athensToUtc(2030, 3, 4, 10, 30));

    const forced = await createAppointment(sec, { patientId: p2.id, typeId: first, resourceId: doctor, date: MON, time: "10:15", override: true }, ctx);
    if (!forced.ok) throw new Error(forced.error);
    expect((await db.appointmentEvent.findFirstOrThrow({ where: { appointmentId: forced.id } })).details).toMatchObject({ override: ["appointment"] });
    expect(await db.auditLog.count({ where: { action: "appointment.created", entityId: p2.id } })).toBe(1);
  });

  it("knows office hours, holidays, blocks and the same patient elsewhere", async () => {
    const sec = await makeActor("USER", [c.surgery], "SECRETARY");
    const p = await makePatient(c.surgery, { surname: `Ωράριο ${tag()}` });
    const at = async (date: string, time: string, resourceId = doctor, patientId = p.id) => {
      const r = await createAppointment(sec, { patientId, typeId: first, resourceId, date, time }, ctx);
      return r.ok ? [] : (r.problems ?? []).map((x) => x.kind);
    };
    expect(await at(MON, "15:00")).toEqual(["outside_hours"]); // lunch gap 14:00–17:00
    expect(await at(MON, "13:45")).toEqual(["outside_hours"]); // runs past 14:00
    expect(await at("2030-03-09", "10:00")).toEqual(["outside_hours"]); // Saturday
    expect(await at("2030-03-11", "10:00")).toEqual(["holiday"]); // Clean Monday 2030
    await db.calendarBlock.create({ data: { companyId: c.surgery, resourceId: doctor, kind: "CONGRESS", label: "Συνέδριο", startsAt: athensToUtc(2030, 3, 5, 9, 0), endsAt: athensToUtc(2030, 3, 5, 14, 0) } });
    expect(await at("2030-03-05", "11:00")).toEqual(["block"]);
    expect(await at("2030-03-06", "11:00")).toEqual([]);
    expect(await at("2030-03-06", "11:00", nurse)).toEqual(["patient"]); // already with the doctor then
  });

  it("free slots skip lunch, holidays and taken times", async () => {
    const slots = await freeSlots(c.surgery, doctor, athensToUtc(2030, 3, 8, 13, 0), 30, { limit: 3, now: new Date(2020, 0, 1) });
    // Friday 13:00, 13:15, 13:30 (13:30–14:00 fits; 13:45 would not).
    expect(slots).toEqual([athensToUtc(2030, 3, 8, 13, 0), athensToUtc(2030, 3, 8, 13, 15), athensToUtc(2030, 3, 8, 13, 30)]);
    const after = await freeSlots(c.surgery, doctor, athensToUtc(2030, 3, 8, 20, 45), 30, { limit: 1, now: new Date(2020, 0, 1) });
    // Not Saturday, not Sunday, not Clean Monday (11/3) → Tuesday 12/3 09:00.
    expect(after).toEqual([athensToUtc(2030, 3, 12, 9, 0)]);
  });
});

describe("status and moving", () => {
  it("follows the one status list; pressing twice does nothing; 'done' after 'to pay' is money", async () => {
    const sec = await makeActor("USER", [c.surgery], "SECRETARY");
    const surgeon = await makeActor("USER", [c.surgery], "SURGEON");
    const p = await makePatient(c.surgery, { surname: `Ροής ${tag()}` });
    const r = await createAppointment(sec, { patientId: p.id, typeId: first, resourceId: doctor, date: "2030-03-07", time: "18:00" }, ctx);
    if (!r.ok) throw new Error(r.error);
    expect(await setAppointmentStatus(sec, r.id, "ARRIVED", {}, ctx)).toEqual({ ok: true, changed: true });
    expect(await setAppointmentStatus(sec, r.id, "READY", { room: "Δωμάτιο 1" }, ctx)).toEqual({ ok: true, changed: true });
    expect(await setAppointmentStatus(sec, r.id, "READY", { room: "Δωμάτιο 2" }, ctx)).toEqual({ ok: true, changed: false });
    expect((await db.appointment.findUniqueOrThrow({ where: { id: r.id } })).room).toBe("Δωμάτιο 1");
    expect(await setAppointmentStatus(surgeon, r.id, "WITH_DOCTOR", {}, ctx)).toEqual({ ok: true, changed: true });
    expect(await setAppointmentStatus(surgeon, r.id, "TO_PAY", {}, ctx)).toEqual({ ok: true, changed: true });
    expect(await setAppointmentStatus(surgeon, r.id, "DONE", {}, ctx)).toEqual({ ok: false, error: "forbidden" });
    expect(await setAppointmentStatus(sec, r.id, "DONE", {}, ctx)).toEqual({ ok: true, changed: true });
    expect(await setAppointmentStatus(sec, r.id, "NO_SHOW", {}, ctx)).toEqual({ ok: false, error: "not_allowed" });
    const events = await db.appointmentEvent.findMany({ where: { appointmentId: r.id }, orderBy: { at: "asc" } });
    expect(events.map((e) => e.toStatus)).toEqual(["BOOKED", "ARRIVED", "READY", "WITH_DOCTOR", "TO_PAY", "DONE"]);
    expect(checkTransition({ level: "GUEST", role: "OTHER" }, "BOOKED", "CONFIRMED")).toBe("forbidden");
  });

  it("moves an appointment (clash-checked) and frees the old time; cancelled time is free again", async () => {
    const sec = await makeActor("USER", [c.surgery], "SECRETARY");
    const p = await makePatient(c.surgery, { surname: `Μετακίνησης ${tag()}` });
    const r = await createAppointment(sec, { patientId: p.id, typeId: first, resourceId: doctor, date: "2030-03-13", time: "11:00" }, ctx);
    if (!r.ok) throw new Error(r.error);
    expect(await moveAppointment(sec, r.id, { date: "2030-03-13", time: "12:00", minutes: 45 }, ctx)).toEqual({ ok: true, overridden: [] });
    const a = await db.appointment.findUniqueOrThrow({ where: { id: r.id } });
    expect([a.startsAt, a.endsAt]).toEqual([athensToUtc(2030, 3, 13, 12, 0), athensToUtc(2030, 3, 13, 12, 45)]);
    const other = await createAppointment(sec, { typeId: first, resourceId: doctor, date: "2030-03-13", time: "11:00" }, ctx);
    expect(other.ok).toBe(true);
    expect(await setAppointmentStatus(sec, r.id, "CANCELLED", { reason: "ζήτησε αλλαγή" }, ctx)).toEqual({ ok: true, changed: true });
    expect((await createAppointment(sec, { typeId: first, resourceId: doctor, date: "2030-03-13", time: "12:00" }, ctx)).ok).toBe(true);
  });

  it("refuses Guests and other companies", async () => {
    expect(await createAppointment(await makeActor("GUEST", [c.surgery]), { typeId: first, resourceId: doctor, date: MON, time: "09:00" }, ctx)).toEqual({ ok: false, error: "forbidden" });
    expect(await createAppointment(await makeActor("USER", [c.spa], "SPA_STAFF"), { typeId: first, resourceId: doctor, date: MON, time: "09:00" }, ctx)).toEqual({ ok: false, error: "not_found" });
  });
});

describe("calendar ↔ visits (6a-4)", () => {
  it("'Έναρξη επίσκεψης' goes via 'arrived' to 'with the doctor'; saving a charged visit → 'to pay'; closing it → 'done'", async () => {
    const sec = await makeActor("USER", [c.surgery], "SECRETARY");
    const surgeon = await makeActor("USER", [c.surgery], "SURGEON");
    const p = await makePatient(c.surgery, { surname: `Έναρξης ${tag()}` });
    const r = await createAppointment(sec, { patientId: p.id, typeId: first, resourceId: doctor, date: "2030-03-18", time: "09:00" }, ctx);
    if (!r.ok) throw new Error(r.error);
    expect(await startVisit(surgeon, r.id, ctx)).toEqual({ ok: true, patientId: p.id });
    const events = await db.appointmentEvent.findMany({ where: { appointmentId: r.id }, orderBy: { at: "asc" } });
    expect(events.map((e) => e.toStatus)).toEqual(["BOOKED", "ARRIVED", "WITH_DOCTOR"]);

    const type = await db.listItem.create({ data: { companyId: c.surgery, kind: "VISIT_TYPE", label: `Πρώτη ${tag()}`, chargeable: true, defaultFeeCents: 10000 } });
    const v = await createVisit(surgeon, p.id, { typeId: type.id }, ctx);
    if (!v.ok) throw new Error(v.error);
    expect(await linkVisit(surgeon, r.id, v.id, ctx)).toEqual({ ok: true });
    expect(await db.appointment.findUniqueOrThrow({ where: { id: r.id } })).toMatchObject({ visitId: v.id, status: "TO_PAY" });

    expect(await setVisitClosed(sec, v.id, true, ctx)).toEqual({ ok: true });
    expect((await db.appointment.findUniqueOrThrow({ where: { id: r.id } })).status).toBe("DONE");

    // The day data tells when each entered its current status.
    const day = await calendarDay(sec, c.surgery, "2030-03-18");
    expect(day?.appointments.find((a) => a.id === r.id)).toMatchObject({ status: "DONE", visitId: v.id, statusAt: expect.stringMatching(/^\d{2}:\d{2}$/) });
    // Rooms are where patients wait for the doctor, never calendar columns.
    expect(day?.rooms.length).toBeGreaterThan(0);
    expect(day?.columns.some((col) => col.kind === "ROOM")).toBe(false);
  });

  it("a visit without a fee goes straight to 'done'; another patient's visit is refused", async () => {
    const sec = await makeActor("USER", [c.surgery], "SECRETARY");
    const surgeon = await makeActor("USER", [c.surgery], "SURGEON");
    const p = await makePatient(c.surgery, { surname: `Δωρεάν ${tag()}` });
    const other = await makePatient(c.surgery, { surname: `Άλλος ${tag()}` });
    const r = await createAppointment(sec, { patientId: p.id, typeId: first, resourceId: doctor, date: "2030-03-18", time: "10:00" }, ctx);
    if (!r.ok) throw new Error(r.error);
    await startVisit(surgeon, r.id, ctx);
    const free = await db.listItem.create({ data: { companyId: c.surgery, kind: "VISIT_TYPE", label: `Επανέλεγχος ${tag()}` } });
    const wrong = await createVisit(surgeon, other.id, { typeId: free.id }, ctx);
    const v = await createVisit(surgeon, p.id, { typeId: free.id }, ctx);
    if (!v.ok || !wrong.ok) throw new Error("visit");
    expect(await linkVisit(surgeon, r.id, wrong.id, ctx)).toEqual({ ok: false, error: "not_found" });
    expect(await linkVisit(surgeon, r.id, v.id, ctx)).toEqual({ ok: true });
    expect((await db.appointment.findUniqueOrThrow({ where: { id: r.id } })).status).toBe("DONE");
  });
});

describe("home greeting", () => {
  it("by the hour, and one line per day that stays the same all day", () => {
    expect(greetingFor("2026-10-12", 9).hello).toBe("Καλημέρα, γιατρέ");
    expect(greetingFor("2026-10-12", 13).hello).toBe("Καλό μεσημέρι, γιατρέ");
    expect(greetingFor("2026-10-12", 19).hello).toBe("Καλησπέρα, γιατρέ");
    expect(greetingFor("2026-10-12", 9).line).toBe(greetingFor("2026-10-12", 20).line);
    expect(greetingFor("2026-10-12", 9).line).not.toBe(greetingFor("2026-10-13", 9).line);
    expect(greetingFor("2025-12-31", 9).line).toBeTruthy(); // before the start date still works
  });
});
