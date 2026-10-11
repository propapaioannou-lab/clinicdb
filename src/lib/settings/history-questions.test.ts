import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { questionChoices } from "@/lib/history/history";
import { companies, ctx, makeActor } from "../../../test/factories";
import { addQuestion, moveQuestion, updateQuestion } from "./history-questions";

let c: { surgery: string; spa: string };
beforeAll(async () => {
  c = await companies();
});
const base = { section: "heart", labelEl: "Ερώτηση δοκιμής", detailEl: "Ποια;", sensitive: false, infection: false, isActive: true };

describe("settings: medical-history questions", () => {
  it("adds a question with picks at the end of its section; keys never change", async () => {
    const admin = await makeActor("ADMIN", [c.surgery], "OTHER");
    const r = await addQuestion(admin, c.surgery, { ...base, section: "gyn", choices: [{ labelEl: "Ενδομητρίωση", labelEn: "" }, { labelEl: "  " }] }, ctx);
    if (!r.ok || !r.id) throw new Error("add");
    const q = await db.historyQuestion.findUniqueOrThrow({ where: { id: r.id } });
    expect(q.key).toMatch(/^q_[0-9a-f]{8}$/);
    expect(q.labelEn).toBe("Ερώτηση δοκιμής");
    expect(questionChoices(q.choices)).toEqual([{ key: expect.stringMatching(/^c_/), labelEl: "Ενδομητρίωση", labelEn: "Ενδομητρίωση" }]);
    const last = await db.historyQuestion.aggregate({ where: { companyId: c.surgery, section: "gyn" }, _max: { sortOrder: true } });
    expect(q.sortOrder).toBe(last._max.sortOrder);
  });

  it("editing keeps pick keys; a removed pick stays, hidden, so old answers keep their wording", async () => {
    const admin = await makeActor("ADMIN", [c.surgery], "OTHER");
    const r = await addQuestion(admin, c.surgery, { ...base, choices: [{ labelEl: "Α" }, { labelEl: "Β" }] }, ctx);
    if (!r.ok || !r.id) throw new Error("add");
    const [a, b] = questionChoices((await db.historyQuestion.findUniqueOrThrow({ where: { id: r.id } })).choices);
    expect(await updateQuestion(admin, r.id, { ...base, labelEl: "Νέα διατύπωση", sensitive: true, choices: [{ key: b.key, labelEl: "Β2", labelEn: "B2" }, { labelEl: "Γ" }] }, ctx)).toEqual({ ok: true });
    const q = await db.historyQuestion.findUniqueOrThrow({ where: { id: r.id } });
    expect(q).toMatchObject({ labelEl: "Νέα διατύπωση", sensitive: true });
    const picks = questionChoices(q.choices);
    expect(picks.map((p) => [p.key === b.key ? "b" : p.key === a.key ? "a" : "new", p.labelEl, !!p.hidden])).toEqual([["b", "Β2", false], ["new", "Γ", false], ["a", "Α", true]]);
    expect((await db.auditLog.findFirstOrThrow({ where: { action: "settings.question.updated", entityId: r.id } })).details).toMatchObject({ changed: ["labelEl", "labelEn", "sensitive", "choices"] });
  });

  it("moves within a section; refuses Users and other companies; needs a question and a real section", async () => {
    const admin = await makeActor("ADMIN", [c.surgery], "OTHER");
    const one = await addQuestion(admin, c.surgery, { ...base, section: "habits" }, ctx);
    const two = await addQuestion(admin, c.surgery, { ...base, section: "habits", labelEl: "Δεύτερη" }, ctx);
    if (!one.ok || !two.ok || !two.id) throw new Error("add");
    expect(await moveQuestion(admin, two.id, -1, ctx)).toEqual({ ok: true });
    const order = await db.historyQuestion.findMany({ where: { companyId: c.surgery, section: "habits" }, orderBy: { sortOrder: "asc" } });
    expect(order.findIndex((q) => q.id === two.id)).toBe(order.findIndex((q) => q.id === one.id) - 1);
    expect(await addQuestion(await makeActor("USER", [c.surgery], "SURGEON"), c.surgery, base, ctx)).toEqual({ ok: false, error: "forbidden" });
    expect(await updateQuestion(await makeActor("ADMIN", [c.spa], "OTHER"), two.id, base, ctx)).toEqual({ ok: false, error: "not_found" });
    expect(await addQuestion(admin, c.surgery, { ...base, section: "moon" }, ctx)).toEqual({ ok: false, error: "invalid_value" });
    expect(await addQuestion(admin, c.surgery, { ...base, labelEl: " " }, ctx)).toEqual({ ok: false, error: "invalid_value" });
  });
});
