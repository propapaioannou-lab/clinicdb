import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { Client } from "pg";
import { companies, ctx, makeActor } from "../../../test/factories";
import { presetsFor, recentMessages, sendMessage } from "./chat";

// 6a-10: internal staff chat.

let c: { surgery: string; spa: string };
const tag = () => Math.random().toString(36).slice(2, 7);

beforeAll(async () => {
  c = await companies();
});

describe("staff chat", () => {
  it("sends, keeps and tells open screens at once; per company; guests have no access", async () => {
    const sec = await makeActor("USER", [c.surgery], "SECRETARY");
    const surgeon = await makeActor("OWNER", [c.surgery, c.spa], "SURGEON");
    // Listen like the live server does (PostgreSQL NOTIFY on "clinic_live").
    const heard: { type: string; message?: { id: string; text: string } }[] = [];
    const pg = new Client({ connectionString: process.env.DATABASE_URL });
    await pg.connect();
    pg.on("notification", (m) => m.payload && heard.push(JSON.parse(m.payload)));
    await pg.query("LISTEN clinic_live");
    const text = `Ήρθε ο επόμενος ${tag()}`;
    const r = await sendMessage(sec, c.surgery, `  ${text}  `, ctx);
    if (!r.ok) throw new Error(r.error);
    await new Promise((res) => setTimeout(res, 300));
    await pg.end();
    expect(heard.some((e) => e.type === "chat" && e.message?.id === r.message.id && e.message?.text === text)).toBe(true);
    expect((await recentMessages(surgeon, c.surgery))!.at(-1)).toMatchObject({ text, senderName: sec.name, senderRole: "SECRETARY" });
    expect((await recentMessages(surgeon, c.spa))!.some((m) => m.id === r.message.id)).toBe(false);
    expect(await db.auditLog.count({ where: { action: "chat.sent", entityId: r.message.id } })).toBe(1);
    expect(await sendMessage(sec, c.surgery, "   ", ctx)).toEqual({ ok: false, error: "empty" });
    expect(await sendMessage(sec, c.spa, "όχι εδώ", ctx)).toEqual({ ok: false, error: "forbidden" });
    const guest = await makeActor("GUEST", [c.surgery]);
    expect(await recentMessages(guest, c.surgery)).toBeNull();
    expect(await sendMessage(guest, c.surgery, "γεια", ctx)).toEqual({ ok: false, error: "forbidden" });
    expect((await sendMessage(sec, c.surgery, "x".repeat(800), ctx)).ok && (await recentMessages(sec, c.surgery))!.at(-1)!.text.length).toBe(500);
  });

  it("the surgeon gets the doctor's presets, everyone else the staff's (editable lists)", async () => {
    const doc = `Φέρε τον επόμενο ${tag()}`;
    const staff = `Περιμένουν 2 ${tag()}`;
    await db.listItem.create({ data: { companyId: c.surgery, kind: "CHAT_PRESET_DOCTOR", label: doc } });
    await db.listItem.create({ data: { companyId: c.surgery, kind: "CHAT_PRESET_STAFF", label: staff } });
    const hidden = await db.listItem.create({ data: { companyId: c.surgery, kind: "CHAT_PRESET_STAFF", label: `Κρυφό ${tag()}`, isActive: false } });
    const surgeon = await makeActor("USER", [c.surgery], "SURGEON");
    const pa = await makeActor("USER", [c.surgery], "PA_NURSE");
    expect(await presetsFor(surgeon, c.surgery)).toContain(doc);
    expect(await presetsFor(surgeon, c.surgery)).not.toContain(staff);
    expect(await presetsFor(pa, c.surgery)).toContain(staff);
    expect(await presetsFor(pa, c.surgery)).not.toContain(hidden.label);
  });
});
