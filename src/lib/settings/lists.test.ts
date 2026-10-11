import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { companies, ctx, makeActor } from "../../../test/factories";
import { addItem, listItems, moveItem, renameItem, setItemActive, setVisitFee } from "./lists";

let c: { surgery: string; spa: string };
beforeAll(async () => {
  c = await companies();
});
const tag = () => Math.random().toString(36).slice(2, 7);

describe("settings lists", () => {
  it("Admin/Owner add, rename, reorder and hide; duplicates refused; all logged", async () => {
    const owner = await makeActor("OWNER", [c.surgery], "SURGEON");
    const a = `Πηγή Α ${tag()}`;
    const b = `Πηγή Β ${tag()}`;
    expect(await addItem(owner, c.surgery, "REFERRAL_SOURCE", `  ${a}  `, ctx)).toEqual({ ok: true });
    expect(await addItem(owner, c.surgery, "REFERRAL_SOURCE", b, ctx)).toEqual({ ok: true });
    expect(await addItem(owner, c.surgery, "REFERRAL_SOURCE", a.toUpperCase(), ctx)).toEqual({ ok: false, error: "duplicate" });
    let list = await listItems(c.surgery, "REFERRAL_SOURCE");
    const idA = list.find((x) => x.label === a)!.id;
    const idB = list.find((x) => x.label === b)!.id;
    expect(list.at(-1)!.id).toBe(idB);
    expect(await moveItem(owner, idB, -1, ctx)).toEqual({ ok: true });
    list = await listItems(c.surgery, "REFERRAL_SOURCE");
    expect(list.findIndex((x) => x.id === idB)).toBe(list.findIndex((x) => x.id === idA) - 1);
    expect(list.map((x) => x.sortOrder)).toEqual(list.map((_, i) => i));
    expect(await renameItem(owner, idA, b, ctx)).toEqual({ ok: false, error: "duplicate" });
    expect(await renameItem(owner, idA, `${a} (νέο)`, ctx)).toEqual({ ok: true });
    expect(await setItemActive(owner, idA, false, ctx)).toEqual({ ok: true });
    expect((await db.listItem.findUniqueOrThrow({ where: { id: idA } })).isActive).toBe(false);
    expect(await db.auditLog.count({ where: { entityId: idA, action: { startsWith: "settings.list." } } })).toBe(3);
  });

  it("refuses Users, Guests, other companies and lists that are not editable", async () => {
    const user = await makeActor("USER", [c.surgery], "SECRETARY");
    expect(await addItem(user, c.surgery, "FLAG_REASON", "x", ctx)).toEqual({ ok: false, error: "forbidden" });
    const spaAdmin = await makeActor("ADMIN", [c.spa], "OTHER");
    expect(await addItem(spaAdmin, c.surgery, "FLAG_REASON", "x", ctx)).toEqual({ ok: false, error: "not_found" });
    const item = await db.listItem.create({ data: { companyId: c.surgery, kind: "FLAG_REASON", label: `Αιτία ${tag()}` } });
    expect(await renameItem(spaAdmin, item.id, "x", ctx)).toEqual({ ok: false, error: "not_found" });
    const admin = await makeActor("ADMIN", [c.surgery], "OTHER");
    expect(await addItem(admin, c.surgery, "CONDITION", "x", ctx)).toEqual({ ok: false, error: "not_found" });
    expect(await addItem(admin, c.surgery, "FLAG_REASON", "   ", ctx)).toEqual({ ok: false, error: "invalid_value" });
  });

  it("visit fees: Secretary / PA only — never the surgeon, not even the Owner", async () => {
    const type = await db.listItem.create({ data: { companyId: c.surgery, kind: "VISIT_TYPE", label: `Τύπος ${tag()}` } });
    const owner = await makeActor("OWNER", [c.surgery], "SURGEON");
    const sec = await makeActor("USER", [c.surgery], "SECRETARY");
    expect(await setVisitFee(owner, type.id, true, "100", ctx)).toEqual({ ok: false, error: "forbidden" });
    expect(await setVisitFee(sec, type.id, true, "", ctx)).toEqual({ ok: false, error: "invalid_value" });
    expect(await setVisitFee(sec, type.id, true, "-5", ctx)).toEqual({ ok: false, error: "invalid_value" });
    expect(await setVisitFee(sec, type.id, true, "120,50", ctx)).toEqual({ ok: true });
    expect(await db.listItem.findUniqueOrThrow({ where: { id: type.id } })).toMatchObject({ chargeable: true, defaultFeeCents: 12050 });
    expect(await setVisitFee(sec, type.id, false, "", ctx)).toEqual({ ok: true });
    expect(await db.listItem.findUniqueOrThrow({ where: { id: type.id } })).toMatchObject({ chargeable: false, defaultFeeCents: null });
    const flag = await db.listItem.create({ data: { companyId: c.surgery, kind: "FLAG_REASON", label: `Αιτία ${tag()}` } });
    expect(await setVisitFee(sec, flag.id, true, "10", ctx)).toEqual({ ok: false, error: "not_found" });
  });
});
