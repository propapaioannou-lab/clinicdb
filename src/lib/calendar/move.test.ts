import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { athensToUtc } from "@/lib/time";
import { companies, ctx, makeActor, makePatient } from "../../../test/factories";
import { createAppointment, moveAppointment, setMoveNotify, undoMove } from "./appointments";
import { minuteAt, buildScale, yOf } from "./bands";
import { calendarDay } from "./day";
import { SPA_HOURS } from "./hours";

// 6a-7: moving (drag, resize, «Μετακίνηση», by hand), «Αναίρεση» and the notify tick.

let c: { surgery: string; spa: string };
let doctor: string;
let nurse: string;
let type: string;
const tag = () => Math.random().toString(36).slice(2, 7);

beforeAll(async () => {
  c = await companies();
  doctor = (await db.resource.create({ data: { companyId: c.surgery, kind: "DOCTOR", label: `Δρ move ${tag()}`, hours: SPA_HOURS } })).id;
  nurse = (await db.resource.create({ data: { companyId: c.surgery, kind: "NURSE", label: `Νοσ move ${tag()}`, hours: SPA_HOURS } })).id;
  type = (await db.appointmentType.create({ data: { companyId: c.surgery, labelEl: `Επαν ${tag()}`, labelEn: "F", defaultMinutes: 10 } })).id;
});

describe("dragging maths", () => {
  it("pixels ↔ minutes agree in both bands; a fold gives its nearer edge", () => {
    const s = buildScale({ surgery: [{ from: 450, to: 840 }], office: [{ from: 960, to: 1230 }], items: [] }, "day");
    for (const m of [450, 600, 870, 960, 1085, 1230]) expect(Math.round(minuteAt(s, yOf(s, m)))).toBe(m);
    const fold = s.folds[0];
    expect(minuteAt(s, fold.top + 2)).toBe(870);
    expect(minuteAt(s, fold.top + fold.height - 2)).toBe(960);
  });
});

describe("moving", () => {
  it("to another day, column and length; old place kept in the log; patient told by default", async () => {
    const sec = await makeActor("USER", [c.surgery], "SECRETARY");
    const p = await makePatient(c.surgery, { surname: `Μετ ${tag()}` });
    const r = await createAppointment(sec, { patientId: p.id, typeId: type, resourceId: doctor, date: "2030-05-06", time: "17:00" }, ctx);
    if (!r.ok) throw new Error(r.error);
    const m = await moveAppointment(sec, r.id, { date: "2030-05-07", time: "18:15", minutes: 20, resourceId: nurse }, ctx);
    if (!m.ok) throw new Error(m.error);
    const a = await db.appointment.findUniqueOrThrow({ where: { id: r.id } });
    expect([a.startsAt, a.endsAt, a.resourceId]).toEqual([athensToUtc(2030, 5, 7, 18, 15), athensToUtc(2030, 5, 7, 18, 35), nurse]);
    const ev = await db.appointmentEvent.findUniqueOrThrow({ where: { id: m.eventId } });
    expect(ev.details).toMatchObject({ fromMinutes: 10, fromResource: doctor, resource: nurse, minutes: 20, notifyPatient: true });
  });

  it("«Αναίρεση» puts it back (same person, last change, within 2′) and is logged", async () => {
    const sec = await makeActor("USER", [c.surgery], "SECRETARY");
    const other = await makeActor("USER", [c.surgery], "SECRETARY");
    const r = await createAppointment(sec, { typeId: type, resourceId: doctor, date: "2030-05-08", time: "17:00" }, ctx);
    if (!r.ok) throw new Error(r.error);
    const m = await moveAppointment(sec, r.id, { date: "2030-05-08", time: "20:10", flex: true }, ctx); // into the +30′ zone
    if (!m.ok) throw new Error(m.error);
    expect(await undoMove(other, r.id, m.eventId, ctx)).toMatchObject({ ok: false, error: "not_allowed" });
    const u = await undoMove(sec, r.id, m.eventId, ctx);
    expect(u.ok).toBe(true);
    const a = await db.appointment.findUniqueOrThrow({ where: { id: r.id } });
    expect([a.startsAt, a.resourceId]).toEqual([athensToUtc(2030, 5, 8, 17, 0), doctor]);
    if (!u.ok) throw new Error("undo");
    expect((await db.appointmentEvent.findUniqueOrThrow({ where: { id: u.eventId } })).details).toMatchObject({ undoOf: m.eventId, notifyPatient: false });
    expect(await undoMove(sec, r.id, m.eventId, ctx)).toMatchObject({ ok: false, error: "not_allowed" }); // only the last change
    // Too late: the move is older than 2 minutes.
    const m2 = await moveAppointment(sec, r.id, { date: "2030-05-08", time: "18:00" }, ctx);
    if (!m2.ok) throw new Error(m2.error);
    await db.appointmentEvent.update({ where: { id: m2.eventId }, data: { at: new Date(Date.now() - 3 * 60e3) } });
    expect(await undoMove(sec, r.id, m2.eventId, ctx)).toMatchObject({ ok: false, error: "not_allowed" });
  });

  it("a clash or a closed time is refused; the notify tick is logged", async () => {
    const sec = await makeActor("USER", [c.surgery], "SECRETARY");
    const a1 = await createAppointment(sec, { typeId: type, resourceId: doctor, date: "2030-05-09", time: "17:00" }, ctx);
    const a2 = await createAppointment(sec, { typeId: type, resourceId: doctor, date: "2030-05-09", time: "17:30" }, ctx);
    if (!a1.ok || !a2.ok) throw new Error("booking");
    expect(await moveAppointment(sec, a2.id, { date: "2030-05-09", time: "17:05" }, ctx)).toMatchObject({ ok: false, error: "clash" });
    expect(await moveAppointment(sec, a2.id, { date: "2030-05-11", time: "11:00" }, ctx)).toMatchObject({ ok: false, problems: [{ kind: "weekend" }] });
    const m = await moveAppointment(sec, a2.id, { date: "2030-05-09", time: "18:00" }, ctx);
    if (!m.ok) throw new Error(m.error);
    expect(await setMoveNotify(sec, a2.id, m.eventId, false, ctx)).toEqual({ ok: true });
    const last = await db.appointmentEvent.findFirstOrThrow({ where: { appointmentId: a2.id }, orderBy: { at: "desc" } });
    expect([last.action, last.details]).toEqual(["notify", { notifyPatient: false, forEvent: m.eventId }]);
  });
});

describe("parking (dropped on a taken or too-short time)", () => {
  it("floats over the other appointment until room is made; a free time clears it", async () => {
    const sec = await makeActor("USER", [c.surgery], "SECRETARY");
    const a = await createAppointment(sec, { typeId: type, resourceId: doctor, date: "2030-05-13", time: "17:00", minutes: 30 }, ctx);
    const b = await createAppointment(sec, { typeId: type, resourceId: doctor, date: "2030-05-13", time: "18:00", minutes: 20 }, ctx);
    if (!a.ok || !b.ok) throw new Error("booking");
    // Parked at 17:10 (taken): only on purpose (override), no reason needed.
    expect(await moveAppointment(sec, b.id, { date: "2030-05-13", time: "17:10" }, ctx)).toMatchObject({ ok: false, error: "clash" });
    expect((await moveAppointment(sec, b.id, { date: "2030-05-13", time: "17:10", override: true }, ctx)).ok).toBe(true);
    expect((await db.appointment.findUniqueOrThrow({ where: { id: b.id } })).parkedAt).not.toBeNull();
    const parked = async () => (await calendarDay(sec, c.surgery, "2030-05-13"))!.appointments.find((x) => x.id === b.id)!.parked;
    expect(await parked()).toBe(true);
    // Room is made: the other one moves away → a normal card again.
    expect((await moveAppointment(sec, a.id, { date: "2030-05-13", time: "19:00" }, ctx)).ok).toBe(true);
    expect(await parked()).toBe(false);
    // Moving it to a free time clears the mark for good.
    expect((await moveAppointment(sec, b.id, { date: "2030-05-13", time: "18:30" }, ctx)).ok).toBe(true);
    expect((await db.appointment.findUniqueOrThrow({ where: { id: b.id } })).parkedAt).toBeNull();
    // Closed hours are still refused without a reason.
    expect(await moveAppointment(sec, b.id, { date: "2030-05-13", time: "15:00", override: true }, ctx)).toMatchObject({ ok: false, error: "reason_needed" });
  });

  it("no nurse column on the calendar", async () => {
    const sec = await makeActor("USER", [c.surgery], "SECRETARY");
    const day = (await calendarDay(sec, c.surgery, "2030-05-13"))!;
    expect(day.columns.some((col) => col.id === nurse)).toBe(false);
    expect(day.columns.some((col) => col.id === doctor)).toBe(true);
  });
});
