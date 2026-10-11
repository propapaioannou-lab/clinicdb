import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { companies, ctx, makeActor, makePatient } from "../../../test/factories";
import { listPatients, recentlyOpened } from "./queries";
import { openPatient } from "./record";
import { parseQuery, quickSearch } from "./search";

let c: { surgery: string; spa: string };
let ids: Record<string, string>;
const names = async (actor: Awaited<ReturnType<typeof makeActor>>, q: string) =>
  (await quickSearch(actor, q)).map((r) => `${r.surname} ${r.firstName}`);

beforeAll(async () => {
  c = await companies();
  const make = (company: string, p: Parameters<typeof makePatient>[1]) => makePatient(company, p).then((x) => x.id);
  ids = {
    maria: await make(c.surgery, { surname: "Σεαρχοπούλου", firstName: "Μαρία", phones: ["+30 694 555 1212"], emails: ["Maria.S@example.com"], amka: "15068012345", birthDate: new Date(Date.UTC(1980, 5, 15)) }),
    eleni: await make(c.surgery, { surname: "Σεαρχοπούλου", firstName: "Ελένη" }),
    // "Μαρία" also appears, but not at the start of the surname.
    other: await make(c.surgery, { surname: "Αβαρχίδου", firstName: "Μαρία Σεαρχοπούλου" }),
    latin: await make(c.surgery, { surname: "SEARCHOPOULOU", firstName: "MARIA" }),
    spa: await make(c.spa, { surname: "Σεαρχοπούλου", firstName: "Σπα" }),
    archived: await make(c.surgery, { surname: "Σεαρχοπούλου", firstName: "Αρχειο", archived: true }),
    numbered: await make(c.surgery, { surname: "Νουμεράκη", number: 777001 }),
  };
});

describe("parseQuery", () => {
  it("tells names, numbers and emails apart", () => {
    expect(parseQuery("  ").kind).toBe("empty");
    expect(parseQuery("Μαρία").kind).toBe("name");
    expect(parseQuery("+30 694-555").kind).toBe("digits");
    expect(parseQuery("a@b").kind).toBe("email");
    expect(parseQuery("P-004218")).toEqual({ kind: "digits", digits: "4218" });
    expect(parseQuery("ρ-4218")).toEqual({ kind: "digits", digits: "4218" });
  });
});

describe("quickSearch", () => {
  it("finds Greek and Greeklish, with or without accents, in any word order", async () => {
    const user = await makeActor("USER", [c.surgery]);
    for (const q of ["σεαρχοπουλου μαρια", "Μαρία Σεαρχοπούλου", "searchopoulou maria", "SEARXOPULU"]) {
      const found = await names(user, q);
      expect(found, q).toContain("Σεαρχοπούλου Μαρία");
      expect(found, q).toContain("SEARCHOPOULOU MARIA");
    }
  });

  it("puts surnames that start with the search first", async () => {
    const user = await makeActor("USER", [c.surgery]);
    const found = await names(user, "μαρια");
    expect(found.indexOf("Σεαρχοπούλου Μαρία")).toBeGreaterThanOrEqual(0);
    const found2 = await names(user, "σεαρχ");
    expect(found2.at(-1)).toBe("Αβαρχίδου Μαρία Σεαρχοπούλου");
  });

  it("finds by patient number, phone (any format), email and AMKA", async () => {
    const user = await makeActor("USER", [c.surgery]);
    expect((await quickSearch(user, "777001"))[0].id).toBe(ids.numbered);
    for (const q of ["6945551212", "0030 694 555", "555 12", "maria.s@", "150680"]) {
      expect((await quickSearch(user, q)).map((r) => r.id), q).toContain(ids.maria);
    }
  });

  it("lets Guests search by name and number only, and returns no phones", async () => {
    const guest = await makeActor("GUEST", [c.surgery]);
    for (const q of ["6945551212", "maria.s@example.com", "15068012345"]) {
      expect(await quickSearch(guest, q), q).toEqual([]);
    }
    const hits = await quickSearch(guest, "σεαρχοπουλου μαρια");
    const hit = hits.find((h) => h.id === ids.maria)!;
    expect(hit).toBeDefined();
    expect("phones" in hit).toBe(false);
    expect((await quickSearch(guest, "777001"))[0].id).toBe(ids.numbered);
  });

  it("never shows patients of another company or archived ones", async () => {
    const surgeryOnly = await makeActor("OWNER", [c.surgery]);
    const found = (await quickSearch(surgeryOnly, "σεαρχοπουλου")).map((r) => r.id);
    expect(found).not.toContain(ids.spa);
    expect(found).not.toContain(ids.archived);
    const spaOnly = await makeActor("USER", [c.spa]);
    expect((await quickSearch(spaOnly, "σεαρχοπουλου")).map((r) => r.id)).toEqual([ids.spa]);
    expect(await quickSearch(spaOnly, "777001")).toEqual([]);
  });

  it("forgives a spelling mistake when nothing matches exactly", async () => {
    const user = await makeActor("USER", [c.surgery]);
    expect((await quickSearch(user, "Σεαρχοπόλου")).map((r) => r.id)).toContain(ids.maria);
  });

  it("filters the full list the same way", async () => {
    const user = await makeActor("USER", [c.surgery]);
    const { total, rows } = await listPatients(user, { page: 1, q: "searchopoulou" });
    expect(total).toBe(4);
    expect(rows.map((r) => r.id)).not.toContain(ids.archived);
    expect(rows.every((r) => r.match === "name")).toBe(true);
  });

  it("says which field matched", async () => {
    const user = await makeActor("USER", [c.surgery]);
    const field = async (q: string) => (await listPatients(user, { page: 1, q })).rows.find((r) => r.id === ids.maria)?.match;
    expect(await field("6945551212")).toBe("phone");
    expect(await field("150680")).toBe("amka");
    expect(await field("maria.s@")).toBe("email");
    const byCode = await listPatients(user, { page: 1, q: "P-777001" });
    expect(byCode.rows.map((r) => [r.id, r.match])).toEqual([[ids.numbered, "code"]]);
  });

  it("lists flagged patients only when asked", async () => {
    const user = await makeActor("USER", [c.surgery]);
    await db.patient.update({ where: { id: ids.eleni }, data: { flag: "YELLOW" } });
    const { rows } = await listPatients(user, { page: 1, q: "σεαρχ", flagged: true });
    expect(rows.map((r) => r.id)).toEqual([ids.eleni]);
  });
});

describe("recentlyOpened", () => {
  it("lists the patients this user opened, newest first, in their companies only", async () => {
    const user = await makeActor("USER", [c.surgery]);
    await openPatient(user, ids.maria, ctx);
    await openPatient(user, ids.numbered, ctx);
    await openPatient(user, ids.maria, ctx);
    expect((await recentlyOpened(user)).map((p) => p.id)).toEqual([ids.maria, ids.numbered]);
  });
});

describe("openPatient", () => {
  it("logs every view", async () => {
    const user = await makeActor("USER", [c.surgery]);
    const p = await openPatient(user, ids.maria, ctx);
    expect(p?.contacts?.amka).toBe("15068012345");
    const log = await db.auditLog.findFirst({ where: { action: "patient.viewed", actorUserId: user.id }, orderBy: { id: "desc" } });
    expect(log?.entityId).toBe(ids.maria);
    expect(log?.companyId).toBe(c.surgery);
  });

  it("hides AMKA and date of birth from Guests but still gives the age", async () => {
    const guest = await makeActor("GUEST", [c.surgery]);
    const p = await openPatient(guest, ids.maria, ctx);
    expect(p?.contacts).toBeNull();
    expect(p?.flag).toBe("NONE");
    expect(JSON.stringify(p)).not.toContain("15068012345");
    expect(JSON.stringify(p)).not.toContain("6945551212");
    expect(p?.ageFrom).toBeInstanceOf(Date);
    expect(await db.auditLog.count({ where: { action: "patient.viewed", actorUserId: guest.id } })).toBe(1);
  });

  it("refuses other companies, and archived patients except to Owners", async () => {
    const spaOnly = await makeActor("ADMIN", [c.spa]);
    expect(await openPatient(spaOnly, ids.maria, ctx)).toBeNull();
    const admin = await makeActor("ADMIN", [c.surgery]);
    expect(await openPatient(admin, ids.archived, ctx)).toBeNull();
    const owner = await makeActor("OWNER", [c.surgery]);
    expect((await openPatient(owner, ids.archived, ctx))?.id).toBe(ids.archived);
  });
});
