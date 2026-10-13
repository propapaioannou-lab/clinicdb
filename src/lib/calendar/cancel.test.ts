import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { companies, ctx, makeActor, makePatient } from "../../../test/factories";
import { createAppointment } from "./appointments";
import { cancelAppointment, cancelPreview } from "./cancel";
import { SPA_HOURS } from "./hours";
import { addToWaitlist, listWaitlist, removeFromWaitlist } from "./waitlist";

// 6a-8: cancel — never delete; automatic flags; minimal waiting list.

let c: { surgery: string; spa: string };
let doctor: string;
let type: string;
let short: string;
const tag = () => Math.random().toString(36).slice(2, 7);
const H = 36e5;

beforeAll(async () => {
  c = await companies();
  doctor = (await db.resource.create({ data: { companyId: c.surgery, kind: "DOCTOR", label: `Δρ cancel ${tag()}`, hours: SPA_HOURS } })).id;
  type = (await db.appointmentType.create({ data: { companyId: c.surgery, labelEl: `Συμβ ${tag()}`, labelEn: "C", defaultMinutes: 30 } })).id;
  short = (await db.appointmentType.create({ data: { companyId: c.surgery, labelEl: `Botox ${tag()}`, labelEn: "B", defaultMinutes: 10 } })).id;
  for (const label of ["Ακύρωσε την τελευταία στιγμή", "Δεν ήρθε στο ραντεβού"]) {
    await db.listItem.upsert({ where: { companyId_kind_label: { companyId: c.surgery, kind: "FLAG_REASON", label } }, update: { isActive: true }, create: { companyId: c.surgery, kind: "FLAG_REASON", label } });
  }
});

// An appointment `hours` from now (made directly: the time rules are tested elsewhere).
async function at(patientId: string | null, hours: number, minutes = 30) {
  const startsAt = new Date(Math.round((Date.now() + hours * H) / 6e4) * 6e4);
  return db.appointment.create({ data: { companyId: c.surgery, patientId, typeId: type, resourceId: doctor, startsAt, endsAt: new Date(startsAt.getTime() + minutes * 6e4) } });
}

describe("cancel — never delete", () => {
  it("≥ 48 h: «Ακύρωση», no flag; the appointment stays, the time is free", async () => {
    const sec = await makeActor("USER", [c.surgery], "SECRETARY");
    const p = await makePatient(c.surgery, { surname: `Έγκαιρη ${tag()}` });
    const a = await at(p.id, 72);
    expect((await cancelPreview(sec, a.id))!.suggested).toBe("cancel");
    expect(await cancelAppointment(sec, a.id, { kind: "cancel", reason: "ταξίδι" }, ctx)).toMatchObject({ ok: true, flag: null });
    expect((await db.appointment.findUniqueOrThrow({ where: { id: a.id } })).status).toBe("CANCELLED");
    expect((await db.patient.findUniqueOrThrow({ where: { id: p.id } })).flag).toBe("NONE");
    expect((await db.appointmentEvent.findFirstOrThrow({ where: { appointmentId: a.id, toStatus: "CANCELLED" } })).details).toMatchObject({ cancelKind: "cancel", reason: "ταξίδι" });
  });

  it("< 48 h: yellow + reason; a second within 12 months: red; never lowered", async () => {
    const sec = await makeActor("USER", [c.surgery], "SECRETARY");
    const p = await makePatient(c.surgery, { surname: `Αργή ${tag()}` });
    const a1 = await at(p.id, 20);
    expect((await cancelPreview(sec, a1.id))!).toMatchObject({ suggested: "late", lateFlag: "YELLOW", priorLate: 0 });
    expect(await cancelAppointment(sec, a1.id, { kind: "late" }, ctx)).toMatchObject({ ok: true, flag: "YELLOW" });
    const after1 = await db.patient.findUniqueOrThrow({ where: { id: p.id }, include: { flagReasons: { include: { listItem: true } } } });
    expect([after1.flag, after1.flagReasons.map((r) => r.listItem.label)]).toEqual(["YELLOW", ["Ακύρωσε την τελευταία στιγμή"]]);
    const a2 = await at(p.id, 30);
    expect((await cancelPreview(sec, a2.id))!.lateFlag).toBe("RED");
    expect(await cancelAppointment(sec, a2.id, { kind: "late" }, ctx)).toMatchObject({ ok: true, flag: "RED" });
    expect((await db.patient.findUniqueOrThrow({ where: { id: p.id } })).flag).toBe("RED");
    const logs = await db.auditLog.findMany({ where: { action: "patient.flag_changed", entityId: p.id }, orderBy: { at: "asc" } });
    expect(logs.map((l) => (l.details as { to: string; automatic: boolean }).to)).toEqual(["YELLOW", "RED"]);
    // A red patient who cancels late stays red (no lowering).
    const a3 = await at(p.id, 10);
    await db.appointment.update({ where: { id: a1.id }, data: { startsAt: new Date(Date.now() - 400 * 24 * H) } }); // older than 12 months
    expect(await cancelAppointment(sec, a3.id, { kind: "late" }, ctx)).toMatchObject({ ok: true, flag: "RED" });
  });

  it("«Δεν ήρθε»: only after its time, red; «Λάθος καταχώριση»: reason, hidden, no flag", async () => {
    const sec = await makeActor("USER", [c.surgery], "SECRETARY");
    const p = await makePatient(c.surgery, { surname: `Απών ${tag()}` });
    const future = await at(p.id, 2);
    expect(await cancelAppointment(sec, future.id, { kind: "no_show" }, ctx)).toMatchObject({ ok: false, error: "not_yet" });
    const past = await at(p.id, -1);
    expect(await cancelAppointment(sec, past.id, { kind: "no_show" }, ctx)).toMatchObject({ ok: true, flag: "RED" });
    const q = await makePatient(c.surgery, { surname: `Λάθος ${tag()}` });
    const wrong = await at(q.id, 5);
    expect(await cancelAppointment(sec, wrong.id, { kind: "error" }, ctx)).toMatchObject({ ok: false, error: "reason_needed" });
    expect(await cancelAppointment(sec, wrong.id, { kind: "error", reason: "λάθος ασθενής" }, ctx)).toMatchObject({ ok: true, flag: null });
    expect((await db.appointment.findUniqueOrThrow({ where: { id: wrong.id } })).status).toBe("ENTERED_IN_ERROR");
    expect((await db.patient.findUniqueOrThrow({ where: { id: q.id } })).flag).toBe("NONE");
  });
});

describe("waiting list", () => {
  it("the freed time is offered to who it fits (day, window, length); taken off when done", async () => {
    const sec = await makeActor("USER", [c.surgery], "SECRETARY");
    const who = await makePatient(c.surgery, { surname: `Περιμένει ${tag()}` });
    const wrongDay = await makePatient(c.surgery, { surname: `Άλλημέρα ${tag()}` });
    const tooLong = await makePatient(c.surgery, { surname: `Μακρύ ${tag()}` });
    const cancels = await makePatient(c.surgery, { surname: `Ακυρώνει ${tag()}` });
    // Monday 2030-06-03 17:00–17:30 (Mon–Fri 17–21 in this test column).
    const r = await createAppointment(sec, { patientId: cancels.id, typeId: type, resourceId: doctor, date: "2030-06-03", time: "17:00" }, ctx);
    if (!r.ok) throw new Error(r.error);
    const e1 = await addToWaitlist(sec, c.surgery, { patientId: who.id, typeId: short, days: [1, 3], fromTime: "16:30", toTime: "18:00", note: "ό,τι πιο νωρίς" }, ctx);
    await addToWaitlist(sec, c.surgery, { patientId: wrongDay.id, typeId: short, days: [2] }, ctx);
    await addToWaitlist(sec, c.surgery, { patientId: tooLong.id, typeId: type, fromTime: "17:15" }, ctx); // only 15′ left in the window
    await addToWaitlist(sec, c.surgery, { patientId: cancels.id, typeId: short }, ctx); // the one cancelling
    expect(await addToWaitlist(sec, c.surgery, { patientId: who.id, fromTime: "18:00", toTime: "17:00" }, ctx)).toMatchObject({ ok: false });
    const res = await cancelAppointment(sec, r.id, { kind: "cancel" }, ctx);
    if (!res.ok || !e1.ok) throw new Error("cancel");
    expect(res.matches.map((m) => [m.patientId, m.time, m.minutes])).toEqual([[who.id, "17:00", 10]]);
    expect((await listWaitlist(sec, c.surgery))!.find((x) => x.id === e1.id)).toMatchObject({ days: [1, 3], note: "ό,τι πιο νωρίς" });
    expect(await removeFromWaitlist(sec, e1.id, "booked", ctx)).toEqual({ ok: true });
    expect((await db.waitlistEntry.findUniqueOrThrow({ where: { id: e1.id } })).removedWhy).toBe("booked"); // kept, not deleted
    expect((await listWaitlist(sec, c.surgery))!.some((x) => x.id === e1.id)).toBe(false);
    expect(await listWaitlist(await makeActor("GUEST", [c.surgery]), c.surgery)).toBeNull();
  });
});
