import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { athensToUtc } from "@/lib/time";
import { companies, ctx, makeActor } from "../../../test/factories";
import { addBlock, moveCalendarItem, removeBlock, saveResource, saveType } from "./calendar";

let c: { surgery: string; spa: string };
const tag = () => Math.random().toString(36).slice(2, 7);
beforeAll(async () => {
  c = await companies();
});

describe("settings: calendar", () => {
  it("Owner/Admin add and edit appointment types; length and colour are checked", async () => {
    const admin = await makeActor("ADMIN", [c.surgery], "OTHER");
    const label = `Τηλεφωνική ${tag()}`;
    const r = await saveType(admin, c.surgery, null, { labelEl: label, color: "purple", defaultMinutes: 20, layer: "ONLINE" }, ctx);
    if (!r.ok || !r.id) throw new Error("add");
    expect(await db.appointmentType.findUniqueOrThrow({ where: { id: r.id } })).toMatchObject({ labelEn: label, color: "purple", defaultMinutes: 20, layer: "ONLINE" });
    expect(await saveType(admin, c.surgery, null, { labelEl: label.toUpperCase(), color: "teal", defaultMinutes: 20, layer: "OFFICE" }, ctx)).toEqual({ ok: false, error: "duplicate" });
    expect(await saveType(admin, c.surgery, r.id, { labelEl: label, color: "neon", defaultMinutes: 20, layer: "OFFICE" }, ctx)).toEqual({ ok: false, error: "invalid_value" });
    expect(await saveType(admin, c.surgery, r.id, { labelEl: label, color: "teal", defaultMinutes: 1, layer: "OFFICE" }, ctx)).toEqual({ ok: false, error: "invalid_value" });
    expect(await saveType(admin, c.surgery, r.id, { labelEl: label, color: "teal", defaultMinutes: 25, layer: "OFFICE", isActive: false }, ctx)).toEqual({ ok: true, id: r.id });
    expect((await db.auditLog.findFirstOrThrow({ where: { action: "settings.appointmentType.updated", entityId: r.id } })).details).toMatchObject({ changed: ["color", "layer", "defaultMinutes", "isActive"] });
    expect(await saveType(await makeActor("USER", [c.surgery], "SECRETARY"), c.surgery, null, { labelEl: "x", color: "teal", defaultMinutes: 20, layer: "OFFICE" }, ctx)).toEqual({ ok: false, error: "forbidden" });
  });

  it("resources keep their weekly hours; bad hours and users of other companies are refused", async () => {
    const owner = await makeActor("OWNER", [c.surgery], "SURGEON");
    const hours = [{ day: 2, from: "17:00", to: "21:00" }, { day: 1, from: "09:00", to: "14:00" }];
    const r = await saveResource(owner, c.surgery, null, { label: `Δωμάτιο ${tag()}`, kind: "ROOM", hours }, ctx);
    if (!r.ok || !r.id) throw new Error("add");
    expect((await db.resource.findUniqueOrThrow({ where: { id: r.id } })).hours).toEqual([hours[1], hours[0]]);
    expect(await saveResource(owner, c.surgery, r.id, { label: "x", kind: "ROOM", hours: [{ day: 1, from: "14:00", to: "09:00" }] }, ctx)).toEqual({ ok: false, error: "invalid_value" });
    expect(await saveResource(owner, c.surgery, r.id, { label: "x", kind: "ROOM", hours: [{ day: 8, from: "09:00", to: "10:00" }] }, ctx)).toEqual({ ok: false, error: "invalid_value" });
    const spaUser = await makeActor("USER", [c.spa], "SPA_STAFF");
    expect(await saveResource(owner, c.surgery, r.id, { label: "x", kind: "DOCTOR", userId: spaUser.id, hours: [] }, ctx)).toEqual({ ok: false, error: "invalid_value" });
    const other = await saveResource(owner, c.surgery, null, { label: `Δωμάτιο ${tag()}`, kind: "ROOM", hours: [] }, ctx);
    if (!other.ok || !other.id) throw new Error("add2");
    expect(await moveCalendarItem(owner, "resource", other.id, -1, ctx)).toEqual({ ok: true });
  });

  it("any staff member blocks time (dd/mm/yyyy); removal is logged with what was removed", async () => {
    const sec = await makeActor("USER", [c.surgery], "SECRETARY");
    const r = await addBlock(sec, c.surgery, { kind: "CONGRESS", label: "Συνέδριο ΕΕΠΑΧ", fromDate: "05/03/2031", fromTime: "08:00", toDate: "07/03/2031", toTime: "20:00" }, ctx);
    if (!r.ok || !r.id) throw new Error("block");
    expect(await db.calendarBlock.findUniqueOrThrow({ where: { id: r.id } })).toMatchObject({ resourceId: null, startsAt: athensToUtc(2031, 3, 5, 8, 0), endsAt: athensToUtc(2031, 3, 7, 20, 0) });
    expect(await addBlock(sec, c.surgery, { fromDate: "07/03/2031", toDate: "05/03/2031" }, ctx)).toEqual({ ok: false, error: "invalid_value" });
    expect(await addBlock(sec, c.surgery, { fromDate: "2031-03-05", toDate: "2031-03-06" }, ctx)).toEqual({ ok: false, error: "invalid_value" });
    expect(await addBlock(await makeActor("GUEST", [c.surgery]), c.surgery, { fromDate: "05/03/2031", toDate: "05/03/2031" }, ctx)).toEqual({ ok: false, error: "forbidden" });
    expect(await removeBlock(sec, r.id, ctx)).toEqual({ ok: true });
    expect((await db.auditLog.findFirstOrThrow({ where: { action: "calendar.block.removed", entityId: r.id } })).details).toMatchObject({ kind: "CONGRESS", label: "Συνέδριο ΕΕΠΑΧ" });
  });
});
