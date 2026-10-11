import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { findIn } from "@/lib/visits/catalog";
import { loadCatalog } from "@/lib/visits/catalog-db";
import { relevantProcedures } from "@/lib/visits/relevance";
import { createVisit } from "@/lib/visits/visits";
import { companies, ctx, makeActor, makePatient } from "../../../test/factories";
import { addProcedure, moveProcedure, updateProcedure } from "./procedures";

let c: { surgery: string; spa: string };
// Tests use their own company copy of a few procedures (the seed is not run here).
beforeAll(async () => {
  c = await companies();
  for (const [i, [key, area, labelEl]] of ([["augmentation", "breast", "Αυξητική μαστού"], ["mastopexy", "breast", "Ανόρθωση μαστού"], ["facelift", "face", "Lifting προσώπου"]] as const).entries()) {
    await db.catalogProcedure.upsert({
      where: { companyId_key: { companyId: c.surgery, key } },
      update: {},
      create: { companyId: c.surgery, key, area, labelEl, labelEn: labelEl, sortOrder: i, ...(key === "facelift" && { subs: [{ key: "deepPlane", labelEl: "Deep plane", labelEn: "Deep plane" }] }) },
    });
  }
});

describe("settings: procedure catalogue", () => {
  it("renames, hides and edits sub-options; keys stay; the visit pages follow", async () => {
    const owner = await makeActor("OWNER", [c.surgery], "SURGEON");
    const face = await db.catalogProcedure.findUniqueOrThrow({ where: { companyId_key: { companyId: c.surgery, key: "facelift" } } });
    expect(await updateProcedure(owner, face.id, { labelEl: "Deep plane lifting", labelEn: "Deep plane facelift", isActive: true, subs: [{ labelEl: "Λαιμός" }] }, ctx)).toEqual({ ok: true });
    const catalog = await loadCatalog(c.surgery);
    const fl = findIn(catalog, "facelift")!;
    expect(fl.el).toBe("Deep plane lifting");
    // The old sub-option stays (hidden) so old visits keep their wording.
    expect(fl.subs?.map((s) => [s.el, !!s.hidden])).toEqual([["Λαιμός", false], ["Deep plane", true]]);
    expect((await db.auditLog.findFirstOrThrow({ where: { action: "settings.procedure.updated", entityId: face.id } })).details).toMatchObject({ changed: ["labelEl", "labelEn", "subs"] });
  });

  it("a new procedure gets its own key; a hidden one is not offered but old visits keep it", async () => {
    const owner = await makeActor("OWNER", [c.surgery], "SURGEON");
    const r = await addProcedure(owner, c.surgery, { area: "breast", labelEl: "Ανόρθωση θηλών", subs: [] }, ctx);
    if (!r.ok || !r.id) throw new Error("add");
    const added = await db.catalogProcedure.findUniqueOrThrow({ where: { id: r.id } });
    expect(added.key).toMatch(/^p_[0-9a-f]{8}$/);
    expect(await addProcedure(owner, c.surgery, { area: "breast", labelEl: "ανόρθωση θηλών" }, ctx)).toEqual({ ok: false, error: "duplicate" });
    const masto = await db.catalogProcedure.findUniqueOrThrow({ where: { companyId_key: { companyId: c.surgery, key: "mastopexy" } } });
    // A visit with mastopexy, then mastopexy is hidden.
    const p = await makePatient(c.surgery, { surname: "Καταλόγου" });
    const v = await createVisit(owner, p.id, { procedures: [{ key: "mastopexy" }, { key: added.key }] }, ctx);
    if (!v.ok) throw new Error(v.error);
    expect(await updateProcedure(owner, masto.id, { labelEl: masto.labelEl, isActive: false }, ctx)).toEqual({ ok: true });
    const catalog = await loadCatalog(c.surgery);
    expect(relevantProcedures([{ area: "breast", text: "" }], null, catalog).breast).toEqual(expect.not.arrayContaining(["mastopexy"]));
    expect(relevantProcedures([{ area: "breast", text: "" }], null, catalog).breast).toContain(added.key);
    expect((await db.visit.findUniqueOrThrow({ where: { id: v.id } })).procedures).toEqual([{ key: "mastopexy", subs: [] }, { key: added.key, subs: [] }]);
  });

  it("moves within an area; refuses Users and other companies; needs a name and a real area", async () => {
    const admin = await makeActor("ADMIN", [c.surgery], "OTHER");
    const aug = await db.catalogProcedure.findUniqueOrThrow({ where: { companyId_key: { companyId: c.surgery, key: "augmentation" } } });
    expect(await moveProcedure(admin, aug.id, 1, ctx)).toEqual({ ok: true });
    expect(await addProcedure(await makeActor("USER", [c.surgery], "SECRETARY"), c.surgery, { area: "face", labelEl: "x" }, ctx)).toEqual({ ok: false, error: "forbidden" });
    expect(await updateProcedure(await makeActor("ADMIN", [c.spa], "OTHER"), aug.id, { labelEl: "x" }, ctx)).toEqual({ ok: false, error: "not_found" });
    expect(await addProcedure(admin, c.surgery, { area: "moon", labelEl: "x" }, ctx)).toEqual({ ok: false, error: "invalid_value" });
    expect(await addProcedure(admin, c.surgery, { area: "face", labelEl: " " }, ctx)).toEqual({ ok: false, error: "invalid_value" });
  });
});
