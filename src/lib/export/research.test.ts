import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { saveHistory } from "@/lib/history/history";
import { createVisit } from "@/lib/visits/visits";
import { companies, ctx, makeActor, makePatient } from "../../../test/factories";
import { researchCode, researchExport, toCsv } from "./research";

let c: { surgery: string; spa: string };
beforeAll(async () => {
  c = await companies();
  // The history questions this test answers (the seed is not run in tests).
  for (const [key, section, labelEl, sensitive] of [["hyper", "heart", "Υπέρταση", false], ["hepc", "infections", "Ηπατίτιδα C", true]] as const) {
    await db.historyQuestion.upsert({
      where: { companyId_key: { companyId: c.surgery, key } },
      update: {},
      create: { companyId: c.surgery, key, section, labelEl, labelEn: labelEl, sensitive, infection: sensitive },
    });
  }
});

describe("research export", () => {
  it("has no names, contact details, AMKA, patient number or birth date; a stable research code instead", async () => {
    const p = await makePatient(c.surgery, {
      surname: "Ερευνητοπούλου", firstName: "Ζωή", birthDate: new Date(Date.UTC(1980, 4, 17)), amka: "17058012345",
      phones: ["6912345678"], emails: ["zoi.erevna@example.com"],
    });
    const surgeon = await makeActor("USER", [c.surgery], "SURGEON");
    await saveHistory(surgeon, p.id, { answers: { hyper: { a: "yes" }, hepc: { a: "yes", d: "2019" } }, weightKg: 70, heightCm: 165 }, ctx);
    const v = await createVisit(surgeon, p.id, { procedures: [{ key: "facelift" }], diagnosis: "Γήρανση προσώπου", weightKg: 72 }, ctx);
    if (!v.ok) throw new Error(v.error);
    const guest = await makeActor("GUEST", [c.surgery]);
    const pats = await researchExport(guest, c.surgery, "patients", ctx);
    const vis = await researchExport(guest, c.surgery, "visits", ctx);
    if (!pats || !vis) throw new Error("export");
    const all = pats.csv + vis.csv;
    for (const secret of ["Ερευνητοπούλου", "Ζωή", "17058012345", "6912345678", "zoi.erevna", "1980-05-17", "17/05/1980", p.id]) expect(all).not.toContain(secret);
    const code = researchCode(p.id);
    expect(code).toMatch(/^R-[0-9A-F]{10}$/);
    expect(researchCode(p.id)).toBe(code);
    const row = pats.csv.split("\r\n").find((l) => l.startsWith(code))!;
    expect(row).toContain(";Ναι");
    expect(vis.csv.split("\r\n").find((l) => l.startsWith(code))).toContain("Γήρανση προσώπου");
    // A Guest never gets the sensitive questions (HIV, hepatitis…); a surgeon-owner does.
    expect(pats.csv).not.toContain("Ηπατίτιδα");
    const owner = await makeActor("OWNER", [c.surgery], "SURGEON");
    expect((await researchExport(owner, c.surgery, "patients", ctx))?.csv).toContain("hepc: Ηπατίτιδα C");
    expect(await db.auditLog.count({ where: { action: "export.research", actorUserId: guest.id } })).toBe(2);
  });

  it("only Guests and Owner/Admin, only their own companies", async () => {
    expect(await researchExport(await makeActor("USER", [c.surgery], "SECRETARY"), c.surgery, "patients", ctx)).toBeNull();
    expect(await researchExport(await makeActor("GUEST", [c.spa]), c.surgery, "patients", ctx)).toBeNull();
  });

  it("cells cannot run as spreadsheet formulas; separators and quotes are escaped", () => {
    expect(toCsv([["=HYPERLINK(\"x\")", "a;b", "+1", "ok"]])).toBe('﻿"\'=HYPERLINK(""x"")";"a;b";\'+1;ok\r\n');
  });
});
