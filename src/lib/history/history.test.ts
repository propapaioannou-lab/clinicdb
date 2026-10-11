import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { companies, ctx, makeActor, makePatient } from "../../../test/factories";
import { allUnansweredNo, answeredCount, bmi, changedParts, cleanHistory } from "./data";
import { riskFactors } from "./risk";
import { openPatient } from "@/lib/patients/record";
import { canVerifyHistory, infectionAlert, loadHistory, loadHistoryVersion, saveHistory, unverifyHistory, verifyHistory } from "./history";
import { HISTORY_QUESTIONS } from "./questions-seed";

let c: { surgery: string; spa: string };
const keys = new Set(HISTORY_QUESTIONS.map((q) => q[0]));

beforeAll(async () => {
  c = await companies();
  await db.historyQuestion.createMany({
    data: HISTORY_QUESTIONS.map(([key, section, labelEl, detailEl, , labelEn, , flags], i) => ({
      companyId: c.surgery, key, section, labelEl, detailEl, labelEn, sortOrder: i,
      sensitive: flags?.sensitive ?? false, infection: flags?.infection ?? false,
    })),
    skipDuplicates: true,
  });
});

describe("cleanHistory", () => {
  it("keeps known answers, drops unknown ones and details on No", () => {
    const d = cleanHistory({ answers: { hyper: { a: "yes", d: " Amlodipine 5 mg " }, heart: { a: "no", d: "ignored" }, bogus: { a: "yes" }, varic: { a: "maybe" } } }, keys);
    expect(d.answers).toEqual({ hyper: { a: "yes", d: "Amlodipine 5 mg" }, heart: { a: "no" } });
  });

  it("checks numbers and smoking follow-ups", () => {
    const d = cleanHistory({ weightKg: "64,5", maxWeightKg: 900, heightCm: 168, smoking: { a: "yes", perDay: "5-20", product: "heated", quit: "x" } }, keys);
    expect(d).toMatchObject({ weightKg: 64.5, heightCm: 168, smoking: { a: "yes", perDay: "5-20", product: "heated" } });
    expect(d.maxWeightKg).toBeUndefined();
    expect(d.smoking).not.toHaveProperty("quit");
  });

  it("keeps previous surgeries with a procedure name only", () => {
    const d = cleanHistory({ surgeries: { a: "yes", items: [{ procedure: "Καισαρική", year: "2019" }, { procedure: " " }] } }, keys);
    expect(d.surgeries).toEqual({ a: "yes", items: [{ procedure: "Καισαρική", year: "2019" }] });
  });

  it("works out BMI, the answered count and what changed", () => {
    expect(bmi(64, 165)).toBe(23.5);
    expect(bmi(undefined, 165)).toBeNull();
    expect(answeredCount({ answers: { hyper: { a: "no" } }, medication: { a: "no" } }, ["hyper", "heart"])).toEqual({ answered: 2, total: 6 });
    expect(changedParts({ answers: { hyper: { a: "no" } } }, { answers: { hyper: { a: "yes" } }, weightKg: 60 })).toEqual(["hyper", "weightKg"]);
  });
});

describe("infection alert", () => {
  const qs = [
    { key: "hepb", labelEl: "Ηπατίτιδα B", infection: true },
    { key: "hepc", labelEl: "Ηπατίτιδα C", infection: true },
    { key: "hyper", labelEl: "Υπέρταση", infection: false },
  ];
  it("lists every Yes, clears when all are No, leaves alone when unanswered", () => {
    expect(infectionAlert(qs, { answers: { hepc: { a: "yes", d: "θεραπεία 2020" }, hepb: { a: "no" } } })).toBe("Ηπατίτιδα C (θεραπεία 2020)");
    expect(infectionAlert(qs, { answers: { hepb: { a: "no" }, hepc: { a: "no" } } })).toBeNull();
    expect(infectionAlert(qs, { answers: { hepb: { a: "no" } } })).toBeUndefined();
  });
});

describe("saving and verifying", () => {
  it("only Surgeons and PA/nurses verify", () => {
    expect(canVerifyHistory({ level: "USER", role: "SURGEON" })).toBe(true);
    expect(canVerifyHistory({ level: "USER", role: "PA_NURSE" })).toBe(true);
    expect(canVerifyHistory({ level: "OWNER", role: "SECRETARY" })).toBe(false);
    expect(canVerifyHistory({ level: "GUEST", role: "SURGEON" })).toBe(false);
  });

  it("a secretary's entry waits; the nurse verifies it; the alert follows the verified answers", async () => {
    const p = await makePatient(c.surgery, { surname: "Ιστορικού" });
    const secretary = await makeActor("USER", [c.surgery], "SECRETARY");
    const nurse = await makeActor("USER", [c.surgery], "PA_NURSE");

    const r1 = await saveHistory(secretary, p.id, { answers: { hepc: { a: "yes", d: "2020" }, hepb: { a: "no" }, hiv: { a: "no" }, otherinf: { a: "no" } } }, ctx);
    expect(r1).toEqual({ ok: true, number: 1, verified: false });
    expect((await db.patient.findUniqueOrThrow({ where: { id: p.id } })).infectiousDiseases).toBeNull();
    expect((await loadHistory(secretary, p.id))?.status).toBe("PENDING");

    expect(await verifyHistory(secretary, p.id, ctx)).toEqual({ ok: false, error: "not_verifier" });
    expect(await verifyHistory(nurse, p.id, ctx)).toEqual({ ok: true });
    const h = await loadHistory(nurse, p.id);
    expect(h).toMatchObject({ status: "VERIFIED", verifiedByName: nurse.name, verifiedRole: "PA_NURSE" });
    expect((await db.patient.findUniqueOrThrow({ where: { id: p.id } })).infectiousDiseases).toBe("Ηπατίτιδα C (2020)");
    expect(await db.auditLog.count({ where: { entityId: p.id, action: { in: ["history.saved", "history.verified"] } } })).toBe(2);

    expect(await unverifyHistory(nurse, p.id, ctx)).toEqual({ ok: true });
    expect((await loadHistory(nurse, p.id))?.status).toBe("PENDING");
  });

  it("a surgeon's entry is verified at once; every save is a new version and old ones stay readable", async () => {
    const p = await makePatient(c.surgery, { surname: "Εκδόσεων" });
    const surgeon = await makeActor("USER", [c.surgery], "SURGEON");
    await saveHistory(surgeon, p.id, { answers: { hyper: { a: "no" } } }, ctx);
    const r2 = await saveHistory(surgeon, p.id, { answers: { hyper: { a: "yes", d: "140/90" } } }, ctx);
    expect(r2).toEqual({ ok: true, number: 2, verified: true });
    const h = await loadHistory(surgeon, p.id);
    expect(h?.versions.map((v) => v.number)).toEqual([2, 1]);
    expect(h?.data?.answers.hyper).toEqual({ a: "yes", d: "140/90" });
    expect((await loadHistoryVersion(surgeon, p.id, 1))?.data.answers.hyper).toEqual({ a: "no" });
    const log = await db.auditLog.findFirstOrThrow({ where: { entityId: p.id, action: "history.saved" }, orderBy: { id: "desc" } });
    expect(log.details).toMatchObject({ version: 2, verified: true, changed: ["hyper"] });
  });

  it("keeps Guests read-only and hides sensitive answers from them; other companies get nothing", async () => {
    const p = await makePatient(c.surgery, { surname: "Ευαίσθητου" });
    const surgeon = await makeActor("USER", [c.surgery], "SURGEON");
    await saveHistory(surgeon, p.id, { answers: { drugs: { a: "yes", d: "κάνναβη" }, hyper: { a: "no" } } }, ctx);
    const guest = await makeActor("GUEST", [c.surgery]);
    expect(await saveHistory(guest, p.id, { answers: {} }, ctx)).toEqual({ ok: false, error: "forbidden" });
    const seen = await loadHistory(guest, p.id);
    expect(seen?.data?.answers).toEqual({ hyper: { a: "no" } });
    expect(seen?.questions.some((q) => q.key === "drugs")).toBe(false);
    expect(JSON.stringify(await loadHistoryVersion(guest, p.id, 1))).not.toContain("κάνναβη");
    expect(await loadHistory(await makeActor("ADMIN", [c.spa]), p.id)).toBeNull();
  });
});

describe("quick picks, 'Όλα Όχι' and the high-risk profile", () => {
  it("keeps only known picks, and notes, on Yes", () => {
    const d = cleanHistory({ medication: { a: "yes", items: ["thyroxine", "bogus", "thyroxine"], d: "Eltroxin 50" }, allergies: { a: "no", items: ["penicillin"] } }, keys);
    expect(d.medication).toEqual({ a: "yes", d: "Eltroxin 50", items: ["thyroxine"] });
    expect(d.allergies).toEqual({ a: "no" });
  });

  it("sets only unanswered items to No", () => {
    const d = allUnansweredNo({ answers: { hyper: { a: "yes" } }, smoking: { a: "yes", perDay: "20+" } }, ["hyper", "heart"]);
    expect(d.answers).toEqual({ hyper: { a: "yes" }, heart: { a: "no" } });
    expect(d.smoking).toEqual({ a: "yes", perDay: "20+" });
    expect(d.medication).toEqual({ a: "no" });
  });

  it("flags heavy smokers (>20), blood thinners, thrombosis/thrombophilia and thyroxine", () => {
    expect(riskFactors({ answers: {}, smoking: { a: "yes", perDay: "5-20" } })).toEqual([]);
    expect(riskFactors({
      answers: { thrombophilia: { a: "yes" } },
      smoking: { a: "yes", perDay: "20+" },
      medication: { a: "yes", items: ["antiplatelets", "thyroxine"] },
    })).toEqual(["heavySmoker", "bloodThinners", "thrombosis", "thyroxine"]);
    expect(riskFactors({ answers: { anticoag: { a: "yes" }, clot: { a: "yes" } } })).toEqual(["bloodThinners", "thrombosis"]);
  });

  it("stores the profile on the patient at every save, even before verification", async () => {
    const p = await makePatient(c.surgery, { surname: "Κινδύνου" });
    const secretary = await makeActor("USER", [c.surgery], "SECRETARY");
    await saveHistory(secretary, p.id, { answers: { anticoag: { a: "yes", d: "Sintrom" } } }, ctx);
    expect((await db.patient.findUniqueOrThrow({ where: { id: p.id } })).riskFactors).toEqual(["bloodThinners"]);
    await saveHistory(secretary, p.id, { answers: { anticoag: { a: "no" } } }, ctx);
    expect((await db.patient.findUniqueOrThrow({ where: { id: p.id } })).riskFactors).toEqual([]);
  });
});

describe("sensitive answers (HIV, hepatitis, substance use, mental health)", () => {
  it("are seen by Surgeon, PA/nurse and Secretary only; others get a nameless infectious alert", async () => {
    const p = await makePatient(c.surgery, { surname: "Απορρήτου" });
    const surgeon = await makeActor("USER", [c.surgery], "SURGEON");
    await saveHistory(surgeon, p.id, { answers: { hepc: { a: "yes", d: "2020" }, hepb: { a: "no" }, hiv: { a: "no" }, otherinf: { a: "no" }, mental: { a: "yes" }, hyper: { a: "no" } } }, ctx);

    const secretary = await makeActor("USER", [c.surgery], "SECRETARY");
    expect((await loadHistory(secretary, p.id))?.data?.answers.hepc).toEqual({ a: "yes", d: "2020" });
    expect((await openPatient(secretary, p.id, ctx))?.infectiousDiseases).toBe("Ηπατίτιδα C (2020)");

    const spa = await makeActor("USER", [c.surgery], "SPA_STAFF");
    const seen = await loadHistory(spa, p.id);
    expect(Object.keys(seen?.data?.answers ?? {})).toEqual(["hyper"]);
    expect(seen?.questions.some((q) => q.key === "hepc" || q.key === "mental")).toBe(false);
    const view = await openPatient(spa, p.id, ctx);
    expect(view?.infectiousDiseases).toBeNull();
    expect(view?.infectiousHidden).toBe(true);
    expect(JSON.stringify(view)).not.toContain("Ηπατίτιδα");
  });
});

