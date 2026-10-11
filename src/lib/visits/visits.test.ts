import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { companies, ctx, makeActor, makePatient } from "../../../test/factories";
import { cleanVisitInput, createVisit, getVisit, listVisits, moneyTotals, setVisitCharge, setVisitClosed, updateVisit, weightSeries } from "./visits";

let c: { surgery: string; spa: string };
let consult: string;
let followUp: string;

beforeAll(async () => {
  c = await companies();
  const tag = Math.random().toString(36).slice(2, 7);
  consult = (await db.listItem.create({ data: { companyId: c.surgery, kind: "VISIT_TYPE", label: `Πρώτη ${tag}`, chargeable: true, defaultFeeCents: 7000 } })).id;
  followUp = (await db.listItem.create({ data: { companyId: c.surgery, kind: "VISIT_TYPE", label: `Επανέλεγχος ${tag}` } })).id;
});

describe("cleanVisitInput", () => {
  it("keeps known areas, procedures and sub-options only", () => {
    const v = cleanVisitInput({
      areas: [{ area: "breast", text: " ασυμμετρία " }, { area: "breast", text: "dup" }, { area: "moon", text: "x" }],
      procedures: [{ key: "facelift", subs: ["deepPlane", "bogus"] }, { key: "nonexistent" }, { key: "augmentation" }],
    });
    if (v === "invalid_value") throw new Error("invalid");
    expect(v.areas).toEqual([{ area: "breast", text: "ασυμμετρία" }]);
    expect(v.procedures).toEqual([{ key: "facelift", subs: ["deepPlane"] }, { key: "augmentation", subs: [] }]);
  });

  it("rejects impossible measurements instead of dropping them", () => {
    expect(cleanVisitInput({ weightKg: "64,5", heightCm: "" })).toMatchObject({ weightKg: 64.5, heightCm: null });
    expect(cleanVisitInput({ weightKg: 900 })).toBe("invalid_value");
    expect(cleanVisitInput({ heightCm: 20 })).toBe("invalid_value");
  });
});

describe("visits", () => {
  it("a surgeon creates a consultation: charged by default, but the surgeon never sees money", async () => {
    const p = await makePatient(c.surgery, { surname: "Επισκέψεως" });
    const surgeon = await makeActor("USER", [c.surgery], "SURGEON");
    const r = await createVisit(surgeon, p.id, { typeId: consult, diagnosis: "Αυξητική", weightKg: 64 }, ctx);
    if (!r.ok) throw new Error(r.error);
    const stored = await db.visit.findUniqueOrThrow({ where: { id: r.id } });
    expect(stored).toMatchObject({ feeCents: 7000, doctorId: surgeon.id, status: "OPEN" });
    expect((await getVisit(surgeon, r.id))?.money).toBeNull();
    expect((await listVisits(surgeon, p.id))?.[0].money).toBeNull();
    expect(await moneyTotals(surgeon, p.id)).toBeNull();
    expect(await setVisitCharge(surgeon, r.id, { feeCents: 1, paidCents: 1, paymentMethod: "cash" }, ctx)).toEqual({ ok: false, error: "forbidden" });
  });

  it("follow-ups carry no charge; the secretary records fee and payment; totals add up", async () => {
    const p = await makePatient(c.surgery, { surname: "Πληρωμής" });
    const secretary = await makeActor("USER", [c.surgery], "SECRETARY");
    const a = await createVisit(secretary, p.id, { typeId: consult }, ctx);
    const b = await createVisit(secretary, p.id, { typeId: followUp }, ctx);
    if (!a.ok || !b.ok) throw new Error("create");
    expect((await db.visit.findUniqueOrThrow({ where: { id: b.id } })).feeCents).toBeNull();
    expect(await setVisitCharge(secretary, a.id, { feeCents: 7000, paidCents: 5000, paymentMethod: "card" }, ctx)).toEqual({ ok: true });
    expect(await moneyTotals(secretary, p.id)).toEqual({ fees: 7000, paid: 5000, balance: 2000 });
    const pa = await makeActor("USER", [c.surgery], "PA_NURSE");
    expect((await getVisit(pa, a.id))?.money).toEqual({ feeCents: 7000, paidCents: 5000, paymentMethod: "card" });
    expect(await db.auditLog.count({ where: { action: "visit.charge_updated", entityId: p.id } })).toBe(1);
  });

  it("the secretary closes after payment; that locks the clinical part; a surgeon can reopen", async () => {
    const p = await makePatient(c.surgery, { surname: "Κλειστής" });
    const surgeon = await makeActor("USER", [c.surgery], "SURGEON");
    const secretary = await makeActor("USER", [c.surgery], "SECRETARY");
    const r = await createVisit(surgeon, p.id, { typeId: consult }, ctx);
    if (!r.ok) throw new Error(r.error);
    // The surgeon has no close button; the secretary closes after payment.
    expect(await setVisitClosed(surgeon, r.id, true, ctx)).toEqual({ ok: false, error: "forbidden" });
    expect(await setVisitCharge(secretary, r.id, { feeCents: 7000, paidCents: 7000, paymentMethod: "cash" }, ctx)).toEqual({ ok: true });
    expect(await setVisitClosed(secretary, r.id, true, ctx)).toEqual({ ok: true });
    expect(await updateVisit(surgeon, r.id, { diagnosis: "αλλαγή" }, ctx)).toEqual({ ok: false, error: "closed" });
    expect(await setVisitClosed(await makeActor("USER", [c.surgery], "SPA_STAFF"), r.id, false, ctx)).toEqual({ ok: false, error: "forbidden" });
    expect(await setVisitClosed(surgeon, r.id, false, ctx)).toEqual({ ok: true });
    expect(await updateVisit(surgeon, r.id, { diagnosis: "αλλαγή", typeId: consult }, ctx)).toEqual({ ok: true });
    const log = await db.auditLog.findFirstOrThrow({ where: { action: "visit.updated", entityId: p.id } });
    expect(log.details).toMatchObject({ changed: ["diagnosis"] });
  });

  it("refuses Guests, other companies and another company's visit types; Guests may read", async () => {
    const p = await makePatient(c.surgery, { surname: "Ξένης" });
    const surgeon = await makeActor("USER", [c.surgery], "SURGEON");
    const guest = await makeActor("GUEST", [c.surgery]);
    expect(await createVisit(guest, p.id, {}, ctx)).toEqual({ ok: false, error: "forbidden" });
    expect(await createVisit(await makeActor("USER", [c.spa], "SURGEON"), p.id, {}, ctx)).toEqual({ ok: false, error: "not_found" });
    const spaType = await db.listItem.create({ data: { companyId: c.spa, kind: "VISIT_TYPE", label: `Spa ${Math.random()}` } });
    expect(await createVisit(surgeon, p.id, { typeId: spaType.id }, ctx)).toEqual({ ok: false, error: "invalid_type" });
    const r = await createVisit(surgeon, p.id, {}, ctx);
    if (!r.ok) throw new Error(r.error);
    expect((await getVisit(guest, r.id))?.money).toBeNull();
  });

  it("gives the weight trend oldest first and the previous visit for reference", async () => {
    const p = await makePatient(c.surgery, { surname: "Βάρους" });
    const surgeon = await makeActor("USER", [c.surgery], "SURGEON");
    await createVisit(surgeon, p.id, { startedAt: "2026-05-01T09:00:00Z", weightKg: 68, areas: [{ area: "face", text: "πρώτη" }] }, ctx);
    const last = await createVisit(surgeon, p.id, { startedAt: "2026-09-01T09:00:00Z", weightKg: 64 }, ctx);
    if (!last.ok) throw new Error(last.error);
    expect((await weightSeries(p.id)).map((w) => w.kg)).toEqual([68, 64]);
    expect((await getVisit(surgeon, last.id))?.previous).toMatchObject({ findings: "πρώτη", weightKg: 68 });
  });

  it("keeps the findings text as written, together with the structured choices", async () => {
    const p = await makePatient(c.surgery, { surname: "Μαστού" });
    const surgeon = await makeActor("USER", [c.surgery], "SURGEON");
    const r = await createVisit(surgeon, p.id, {
      areas: [{ area: "breast", text: "Ασθενής 43 ετών με μέτρια πτώση. Ουλή αριστερά.", exam: { findings: { ptosis: { grade: "2" } }, difficulty: 3 } }],
    }, ctx);
    if (!r.ok) throw new Error(r.error);
    const v = await getVisit(surgeon, r.id);
    expect(v?.areas[0]).toEqual({
      area: "breast",
      text: "Ασθενής 43 ετών με μέτρια πτώση. Ουλή αριστερά.",
      exam: { findings: { ptosis: { grade: "2" } }, difficulty: 3 },
    });
  });
});

