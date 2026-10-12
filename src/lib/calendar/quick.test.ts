import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { companies, ctx, makeActor, makePatient } from "../../../test/factories";
import { createAppointment } from "./appointments";
import { SPA_HOURS } from "./hours";
import { arrive, bookingSearch, maskPhone, quickBook, quickDuplicates, splitName } from "./quick";
import { confirmations } from "./strip";

// 6a-6: quick booking (search, new patient with a name only, tags, duplicates,
// "can't be notified") and «Επιβεβαίωση στοιχείων» at arrival.

let c: { surgery: string; spa: string };
let doctor: string;
let botox: string;
const tag = () => Math.random().toString(36).slice(2, 7);
const mobile = () => `69${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;

beforeAll(async () => {
  c = await companies();
  doctor = (await db.resource.create({ data: { companyId: c.surgery, kind: "DOCTOR", label: `Δρ quick ${tag()}`, hours: SPA_HOURS } })).id;
  botox = (await db.appointmentType.create({ data: { companyId: c.surgery, labelEl: `Botox ${tag()}`, labelEn: "B", defaultMinutes: 10 } })).id;
  if (!(await db.appointmentType.count({ where: { companyId: c.surgery, forNewPatients: true, isActive: true } }))) {
    await db.appointmentType.create({ data: { companyId: c.surgery, labelEl: `Πρώτη ${tag()}`, labelEn: "F", defaultMinutes: 30, forNewPatients: true } });
  }
});

describe("helpers", () => {
  it("splits a name as people say it; masks a phone", () => {
    expect(splitName("  Ιωάννα   Ράπη ")).toEqual({ firstName: "Ιωάννα", surname: "Ράπη" });
    expect(splitName("Μαρία Ελένη Παπαδοπούλου")).toEqual({ firstName: "Μαρία Ελένη", surname: "Παπαδοπούλου" });
    expect(splitName("Ράπη")).toEqual({ firstName: "", surname: "Ράπη" });
    expect(maskPhone("+30 694 412 1214")).toBe("69•• ••• 214"); // +30 dropped
    expect(maskPhone(null)).toBeNull();
  });
});

describe("quick booking", () => {
  it("new patient with a name only: tags, the new-patient type, logged", async () => {
    const sec = await makeActor("USER", [c.surgery], "SECRETARY");
    const name = `Ιωάννα Ραπ${tag()}`;
    const r = await quickBook(sec, { newPatient: { name }, typeId: botox, resourceId: doctor, date: "2030-04-01", time: "17:00" }, ctx);
    if (!r.ok || !("patientId" in r)) throw new Error(JSON.stringify(r));
    const p = await db.patient.findUniqueOrThrow({ where: { id: r.patientId as string }, include: { phones: true } });
    expect([p.firstName, p.tags, p.phones.length]).toEqual(["Ιωάννα", ["to_confirm", "no_phone"], 0]);
    const a = await db.appointment.findUniqueOrThrow({ where: { id: r.id }, include: { type: true } });
    expect(a.type.forNewPatients).toBe(true); // Botox was asked for; a new patient gets the first-visit type
    expect(a.endsAt.getTime() - a.startsAt.getTime()).toBe(a.type.defaultMinutes * 60e3);
    expect((await db.auditLog.findFirstOrThrow({ where: { action: "patient.created", entityId: p.id } })).details).toMatchObject({ tags: ["to_confirm", "no_phone"] });
  });

  it("a refused time creates no patient; a mobile drops the «χωρίς τηλέφωνο» tag", async () => {
    const sec = await makeActor("USER", [c.surgery], "SECRETARY");
    await createAppointment(sec, { typeId: botox, resourceId: doctor, date: "2030-04-02", time: "17:00", minutes: 60 }, ctx);
    const name = `Κλειστή ${tag()}`;
    expect(await quickBook(sec, { newPatient: { name }, typeId: botox, resourceId: doctor, date: "2030-04-02", time: "17:15" }, ctx)).toMatchObject({ ok: false, error: "clash" });
    expect(await db.patient.count({ where: { companyId: c.surgery, surname: name.split(" ")[1] } })).toBe(0);
    const m = mobile();
    const r = await quickBook(sec, { newPatient: { name: `Νίκος ${tag()}`, mobile: m }, typeId: botox, resourceId: doctor, date: "2030-04-02", time: "18:30" }, ctx);
    if (!r.ok || !("patientId" in r)) throw new Error("booking");
    expect((await db.patient.findUniqueOrThrow({ where: { id: r.patientId as string } })).tags).toEqual(["to_confirm"]);
  });

  it("existing patient: found by name or phone, with last visit, next appointment and flag", async () => {
    const sec = await makeActor("USER", [c.surgery], "SECRETARY");
    const m = mobile();
    const p = await makePatient(c.surgery, { surname: `Παπαδοπούλου${tag()}`, firstName: "Ευαγγελία", phones: [m] });
    await db.patient.update({ where: { id: p.id }, data: { flag: "YELLOW" } });
    await createAppointment(sec, { patientId: p.id, typeId: botox, resourceId: doctor, date: "2030-04-03", time: "17:00" }, ctx);
    const byPhone = (await bookingSearch(sec, c.surgery, m.slice(0, 7)))!;
    const hit = byPhone.find((x) => x.id === p.id)!;
    expect(hit).toMatchObject({ flag: "YELLOW", upcoming: expect.stringMatching(/^2030-04-03/), phone: `${m.slice(0, 2)}•• ••• ${m.slice(-3)}` });
    expect((await bookingSearch(sec, c.surgery, `papadopoulou${p.surname.slice(-5)}`))!.some((x) => x.id === p.id)).toBe(true); // Latin letters, no accents
    expect(await bookingSearch(await makeActor("GUEST", [c.surgery]), c.surgery, "Παπ")).toBeNull();
  });

  it("«Μήπως υπάρχει ήδη;»: by mobile, or by name when there is no mobile", async () => {
    const sec = await makeActor("USER", [c.surgery], "SECRETARY");
    const m = mobile();
    const sur = `Ραπτοπούλου${tag()}`;
    const p = await makePatient(c.surgery, { surname: sur, firstName: "Ιωάννα", phones: [m] });
    expect((await quickDuplicates(sec, c.surgery, { name: "Κάποιος Άλλος", mobile: m }))!.map((d) => [d.id, d.by])).toEqual([[p.id, "phone"]]);
    expect((await quickDuplicates(sec, c.surgery, { name: `Ιωάννα ${sur}` }))!.some((d) => d.id === p.id && d.by === "name")).toBe(true);
    expect(await quickDuplicates(sec, c.surgery, { name: `Ιωάννα ${sur}` }, p.id)).not.toContainEqual(expect.objectContaining({ id: p.id }));
  });
});

describe("arrival: «Επιβεβαίωση στοιχείων»", () => {
  it("corrects the name, adds the mobile, clears the tags, logs old and new; then waiting", async () => {
    const sec = await makeActor("USER", [c.surgery], "SECRETARY");
    const r = await quickBook(sec, { newPatient: { name: "Ιωάννα Ράπη" }, resourceId: doctor, date: "2030-04-04", time: "19:00", typeId: botox }, ctx);
    if (!r.ok || !("patientId" in r)) throw new Error("booking");
    const m = mobile();
    expect(await arrive(sec, r.id, { confirm: { firstName: "Ιωάννα", surname: "Ράπτη", mobile: m } }, ctx)).toMatchObject({ ok: true });
    const p = await db.patient.findUniqueOrThrow({ where: { id: r.patientId as string }, include: { phones: true } });
    expect([p.surname, p.tags, p.phones.map((x) => [x.digits, x.isMain, x.type])]).toEqual(["Ράπτη", [], [[m, true, "MOBILE"]]]);
    const log = await db.auditLog.findFirstOrThrow({ where: { action: "patient.detailsConfirmed", entityId: p.id } });
    expect(log.details).toMatchObject({ surname: { from: "Ράπη", to: "Ράπτη" }, tags: { from: ["to_confirm", "no_phone"], to: [] } });
    const a = await db.appointment.findUniqueOrThrow({ where: { id: r.id } });
    expect(a.status).toBe("ARRIVED");
    expect((await db.appointmentEvent.findFirstOrThrow({ where: { appointmentId: r.id, toStatus: "ARRIVED" } })).details).toMatchObject({ detailsCheck: "confirmed" });
  });

  it("can be skipped: the tags stay; bad details are refused", async () => {
    const sec = await makeActor("USER", [c.surgery], "SECRETARY");
    const r = await quickBook(sec, { newPatient: { name: `Σκιπ ${tag()}` }, resourceId: doctor, date: "2030-04-05", time: "17:30", typeId: botox }, ctx);
    if (!r.ok || !("patientId" in r)) throw new Error("booking");
    expect(await arrive(sec, r.id, { confirm: { surname: "Χ", email: "όχι-email" } }, ctx)).toMatchObject({ ok: false, patientError: "invalid_email" });
    expect(await arrive(sec, r.id, { skip: true }, ctx)).toMatchObject({ ok: true });
    expect((await db.patient.findUniqueOrThrow({ where: { id: r.patientId as string } })).tags).toEqual(["to_confirm", "no_phone"]);
    expect((await db.appointmentEvent.findFirstOrThrow({ where: { appointmentId: r.id, toStatus: "ARRIVED" } })).details).toMatchObject({ detailsCheck: "skipped" });
  });
});

describe("tomorrow's confirmations", () => {
  it("no mobile and no email → «Δεν μπορεί να ειδοποιηθεί»; email only → by email", async () => {
    const sec = await makeActor("USER", [c.surgery], "SECRETARY");
    const none = await quickBook(sec, { newPatient: { name: `Χωρίς ${tag()}` }, resourceId: doctor, date: "2030-04-08", time: "17:00", typeId: botox }, ctx);
    const mail = await quickBook(sec, { newPatient: { name: `Μέιλ ${tag()}`, email: `${tag()}@example.com` }, resourceId: doctor, date: "2030-04-08", time: "18:00", typeId: botox }, ctx);
    if (!none.ok || !mail.ok) throw new Error("booking");
    const conf = (await confirmations(sec, c.surgery, "2030-04-05"))!; // Friday → Monday 8/4
    expect(conf.date).toBe("2030-04-08");
    expect(conf.pending.find((p) => p.id === none.id)?.reach).toBe("none");
    expect(conf.pending.find((p) => p.id === mail.id)?.reach).toBe("email");
    expect(conf.cannotNotify).toBeGreaterThanOrEqual(1);
  });
});
