import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { companies, ctx, makeActor, makePatient } from "../../../test/factories";
import { changedIdentity, findDuplicates } from "./duplicates";
import { cleanInput, createPatient, markNotDuplicate, setArchived, setFlag, updatePatient, type PatientInput } from "./manage";

let c: { surgery: string; spa: string };
beforeAll(async () => {
  c = await companies();
});

const uniq = () => Math.random().toString(36).slice(2, 8);
const input = (over: Partial<PatientInput> = {}): PatientInput => ({
  surname: `Δοκιμαστοπούλου${uniq()}`,
  firstName: "Ελένη",
  fatherName: null,
  birthDate: new Date(Date.UTC(1985, 2, 10)),
  sex: "FEMALE",
  maritalStatusId: null,
  occupation: null,
  referralSourceId: null,
  referralNote: null,
  language: "EL",
  area: null,
  address: null,
  city: null,
  postcode: null,
  country: null,
  amka: null,
  afm: null,
  taxOfficeId: null,
  eprescriptionCity: null,
  eprescriptionPhone: null,
  treatingDoctorId: null,
  ghlContactId: null,
  phones: [],
  emails: [],
  ...over,
});

describe("creating patients", () => {
  it("gives the next number in the company, stores search fields and logs it", async () => {
    const user = await makeActor("USER", [c.surgery]);
    await makePatient(c.surgery, { surname: "Ψηλός", number: 500000 });
    const r = await createPatient(user, c.surgery, input({ phones: [{ number: "+30 699 000 1111", type: "MOBILE", isMain: false }], emails: [" Eleni@Example.com "] }), ctx);
    if (!r.ok) throw new Error(r.error);
    expect(r.number).toBeGreaterThan(500000);
    const p = await db.patient.findUniqueOrThrow({ where: { id: r.id }, include: { phones: true, emails: true } });
    expect(p.searchName).toMatch(/^dokimastopulu/);
    expect(p.phones[0]).toMatchObject({ digits: "6990001111", isMain: true, companyId: c.surgery });
    expect(p.emails[0].email).toBe("eleni@example.com");
    expect(await db.auditLog.count({ where: { action: "patient.created", entityId: r.id, actorUserId: user.id } })).toBe(1);
  });

  it("never gives two patients the same number, even when saved at the same moment", async () => {
    const user = await makeActor("USER", [c.spa]);
    const results = await Promise.all(Array.from({ length: 6 }, () => createPatient(user, c.spa, input(), ctx)));
    const numbers = results.map((r) => (r.ok ? r.number : -1));
    expect(new Set(numbers).size).toBe(6);
  });

  it("refuses Guests, other companies and bad data", async () => {
    const guest = await makeActor("GUEST", [c.surgery]);
    expect(await createPatient(guest, c.surgery, input(), ctx)).toEqual({ ok: false, error: "forbidden" });
    const user = await makeActor("USER", [c.surgery]);
    expect(await createPatient(user, c.spa, input(), ctx)).toEqual({ ok: false, error: "forbidden" });
    expect(await createPatient(user, c.surgery, input({ surname: "  " }), ctx)).toEqual({ ok: false, error: "surname_required" });
    expect(await createPatient(user, c.surgery, input({ amka: "123" }), ctx)).toEqual({ ok: false, error: "invalid_amka" });
    expect(await createPatient(user, c.surgery, input({ afm: "12" }), ctx)).toEqual({ ok: false, error: "invalid_afm" });
    expect(await createPatient(user, c.surgery, input({ emails: ["no-at-sign"] }), ctx)).toEqual({ ok: false, error: "invalid_email" });
    expect(await createPatient(user, c.surgery, input({ birthDate: new Date(Date.now() + 864e5) }), ctx)).toEqual({ ok: false, error: "invalid_birth_date" });
  });

  it("accepts as treating doctor only a Surgeon of that company", async () => {
    const user = await makeActor("USER", [c.surgery]);
    const nurse = await makeActor("USER", [c.surgery]);
    expect(await createPatient(user, c.surgery, input({ treatingDoctorId: nurse.id }), ctx)).toEqual({ ok: false, error: "invalid_choice" });
    await db.user.update({ where: { id: nurse.id }, data: { role: "SURGEON" } });
    expect((await createPatient(user, c.surgery, input({ treatingDoctorId: nurse.id }), ctx)).ok).toBe(true);
  });

  it("keeps exactly one main phone", () => {
    const phones = cleanInput(input({ phones: [
      { number: "6900000001", type: "MOBILE", isMain: true },
      { number: "6900000002", type: "MOBILE", isMain: true },
      { number: "  ", type: "HOME", isMain: false },
    ] })).phones;
    expect(phones.map((p) => p.isMain)).toEqual([true, false]);
  });
});

describe("editing patients", () => {
  it("saves changes and logs old and new values of each changed field", async () => {
    const user = await makeActor("USER", [c.surgery]);
    const r = await createPatient(user, c.surgery, input({ city: "Θεσσαλονίκη", phones: [{ number: "6900000010", type: "MOBILE", isMain: true }] }), ctx);
    if (!r.ok) throw new Error(r.error);
    const changed = input({ city: "Κατερίνη", phones: [{ number: "6900000011", type: "MOBILE", isMain: true }] });
    const p0 = await db.patient.findUniqueOrThrow({ where: { id: r.id } });
    expect(await updatePatient(user, r.id, { ...changed, surname: p0.surname }, ctx)).toEqual({ ok: true });
    const log = await db.auditLog.findFirstOrThrow({ where: { action: "patient.updated", entityId: r.id } });
    expect(log.details).toMatchObject({ city: { from: "Θεσσαλονίκη", to: "Κατερίνη" }, phones: { to: ["6900000011 (MOBILE, main)"] } });
    expect(Object.keys(log.details as object)).not.toContain("surname");
  });

  it("leaves the infectious-disease alert alone (it comes from the medical history)", async () => {
    const user = await makeActor("USER", [c.surgery]);
    const r = await createPatient(user, c.surgery, input(), ctx);
    if (!r.ok) throw new Error(r.error);
    await db.patient.update({ where: { id: r.id }, data: { infectiousDiseases: "HCV" } });
    const p0 = await db.patient.findUniqueOrThrow({ where: { id: r.id } });
    expect(await updatePatient(user, r.id, input({ surname: p0.surname, city: "Βέροια" }), ctx)).toEqual({ ok: true });
    expect(await db.patient.findUniqueOrThrow({ where: { id: r.id } })).toMatchObject({
      city: "Βέροια", infectiousDiseases: "HCV",
    });
  });

  it("does not let Guests or other companies edit", async () => {
    const owner = await makeActor("OWNER", [c.surgery]);
    const r = await createPatient(owner, c.surgery, input(), ctx);
    if (!r.ok) throw new Error(r.error);
    expect(await updatePatient(await makeActor("GUEST", [c.surgery]), r.id, input(), ctx)).toEqual({ ok: false, error: "forbidden" });
    expect(await updatePatient(await makeActor("ADMIN", [c.spa]), r.id, input(), ctx)).toEqual({ ok: false, error: "not_found" });
  });
});

describe("flags and archiving", () => {
  it("sets a flag with reasons and logs it; clearing removes the reasons", async () => {
    const user = await makeActor("USER", [c.surgery]);
    const r = await createPatient(user, c.surgery, input(), ctx);
    if (!r.ok) throw new Error(r.error);
    const reason = await db.listItem.create({ data: { companyId: c.surgery, kind: "FLAG_REASON", label: `Λόγος ${uniq()}` } });
    expect(await setFlag(user, r.id, { flag: "RED", reasonIds: [reason.id], note: " άργησε " }, ctx)).toEqual({ ok: true });
    let p = await db.patient.findUniqueOrThrow({ where: { id: r.id }, include: { flagReasons: true } });
    expect(p).toMatchObject({ flag: "RED", flagNote: "άργησε", flagSetById: user.id });
    expect(p.flagReasons).toHaveLength(1);
    await setFlag(user, r.id, { flag: "NONE", reasonIds: [reason.id], note: "x" }, ctx);
    p = await db.patient.findUniqueOrThrow({ where: { id: r.id }, include: { flagReasons: true } });
    expect(p).toMatchObject({ flag: "NONE", flagNote: null, flagSetAt: null });
    expect(p.flagReasons).toHaveLength(0);
    expect(await db.auditLog.count({ where: { action: "patient.flag_changed", entityId: r.id } })).toBe(2);
  });

  it("lets only Owners archive and restore", async () => {
    const owner = await makeActor("OWNER", [c.surgery]);
    const admin = await makeActor("ADMIN", [c.surgery]);
    const r = await createPatient(owner, c.surgery, input(), ctx);
    if (!r.ok) throw new Error(r.error);
    expect(await setArchived(admin, r.id, true, ctx)).toEqual({ ok: false, error: "forbidden" });
    expect(await setArchived(owner, r.id, true, ctx)).toEqual({ ok: true });
    expect((await db.patient.findUniqueOrThrow({ where: { id: r.id } })).archivedAt).not.toBeNull();
    expect(await setArchived(owner, r.id, false, ctx)).toEqual({ ok: true });
    expect((await db.patient.findUniqueOrThrow({ where: { id: r.id } })).archivedAt).toBeNull();
    expect(await db.auditLog.count({ where: { action: { in: ["patient.archived", "patient.unarchived"] }, entityId: r.id } })).toBe(2);
  });
});

describe("duplicate check", () => {
  // Someone unlike anybody else, so only the field under test can match.
  const blank = () => input({ surname: `Q${uniq()}${uniq()}`, firstName: "", birthDate: null });

  it("finds strong, medium and weak matches in the same company only", async () => {
    const tag = uniq();
    const surname = `Ντουπλικάτου${tag}`;
    const existing = await makePatient(c.surgery, {
      surname, firstName: "Μαρία", birthDate: new Date(Date.UTC(1970, 0, 5)), amka: `0501701${tag.slice(0, 4).replace(/\D/g, "0").padEnd(4, "0")}`,
      phones: ["694 777 8899"], emails: [`maria.${tag}@example.com`],
    });
    await makePatient(c.spa, { surname, firstName: "Μαρία", birthDate: new Date(Date.UTC(1970, 0, 5)), phones: ["6947778899"] });

    const byPhone = await findDuplicates(c.surgery, { ...blank(), phones: [{ number: "+30 6947778899", type: "MOBILE", isMain: true }] });
    expect(byPhone.map((d) => [d.id, d.strength, d.reasons])).toEqual([[existing.id, "strong", ["phone"]]]);

    const byEmail = await findDuplicates(c.surgery, { ...blank(), emails: [`maria.${tag}@example.com`] });
    expect(byEmail[0]).toMatchObject({ id: existing.id, strength: "strong" });

    const byNameDob = await findDuplicates(c.surgery, { ...blank(), surname: surname.toUpperCase(), firstName: "ΜΑΡΙΑ", birthDate: new Date(Date.UTC(1970, 0, 5)) });
    expect(byNameDob.find((d) => d.id === existing.id)).toMatchObject({ strength: "medium" });

    const greeklish = await findDuplicates(c.surgery, { ...blank(), surname: `Ntouplikatou${tag}`, firstName: "Maria", birthDate: null });
    expect(greeklish.find((d) => d.id === existing.id)?.reasons).toContain("similar_name");

    const married = await findDuplicates(c.surgery, { ...blank(), surname: `Άλλου${tag}`, firstName: "Μαρία", birthDate: new Date(Date.UTC(1970, 0, 5)) });
    expect(married.find((d) => d.id === existing.id)).toMatchObject({ strength: "weak", reasons: ["first_name_dob"] });
  });

  it("stays quiet for pairs marked 'not the same person'", async () => {
    const user = await makeActor("USER", [c.surgery]);
    const a = await makePatient(c.surgery, { surname: "Κοινότηλέφωνου", phones: ["6941112233"] });
    const b = await makePatient(c.surgery, { surname: "Άλλοόνομα", phones: ["6941112233"] });
    const check = () => findDuplicates(c.surgery, { ...blank(), phones: [{ number: "6941112233", type: "MOBILE", isMain: true }] }, b.id);
    expect((await check()).map((d) => d.id)).toEqual([a.id]);
    await markNotDuplicate(user, c.surgery, b.id, a.id, ctx);
    expect(await check()).toEqual([]);
  });

  it("'create new anyway' remembers the warned records", async () => {
    const user = await makeActor("USER", [c.surgery]);
    const old = await makePatient(c.surgery, { surname: "Παλιάκη", phones: ["6943334455"] });
    const r = await createPatient(user, c.surgery, { ...blank(), phones: [{ number: "6943334455", type: "MOBILE", isMain: true }] }, ctx, { notDuplicateOf: [old.id] });
    if (!r.ok) throw new Error(r.error);
    expect(await findDuplicates(c.surgery, { ...blank(), phones: [{ number: "6943334455", type: "MOBILE", isMain: true }] }, r.id)).toEqual([]);
  });
});

describe("checking duplicates when editing", () => {
  const before = {
    surname: "Παπαδάκη", firstName: "Μαρία", birthDate: new Date(Date.UTC(1980, 0, 1)), amka: "01018012345",
    phones: [{ digits: "6941112233" }], emails: [{ email: "maria@example.com" }],
  };
  const same = {
    surname: "Παπαδάκη", firstName: "Μαρία", birthDate: new Date(Date.UTC(1980, 0, 1)), amka: "01018012345",
    phones: [{ number: "+30 694 111 2233", type: "MOBILE" as const, isMain: true }], emails: ["maria@example.com"],
  };

  it("checks nothing when no identifying detail changed (e.g. only the city)", () => {
    expect(changedIdentity(before, same)).toBeNull();
  });

  it("checks only the new phone, not the name", () => {
    const r = changedIdentity(before, { ...same, phones: [...same.phones, { number: "6950000000", type: "HOME", isMain: false }] });
    expect(r).toEqual({ surname: "", firstName: "", birthDate: null, amka: null, phones: [{ number: "6950000000", type: "HOME", isMain: false }], emails: [] });
  });

  it("checks the name when it changed (e.g. married name)", () => {
    expect(changedIdentity(before, { ...same, surname: "Γεωργίου" })).toMatchObject({ surname: "Γεωργίου", firstName: "Μαρία", phones: [] });
  });
});

