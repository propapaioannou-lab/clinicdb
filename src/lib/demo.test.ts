import { afterEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { login } from "@/lib/auth/login";
import { sendMail } from "@/lib/mail";
import { uploadDocuments } from "@/lib/documents/documents";
import { addSuggestion, listSuggestions, setSuggestionDone, suggestionsMarkdown } from "./demo-suggestions";
import { companies, ctx, lastMailTo, makeActor, makePatient, makeUser } from "../../test/factories";

// The online demo (DEMO_MODE=1): password-only login, nothing sent or stored outside, and
// the «💬 Πρόταση» comments.
const on = () => (process.env.DEMO_MODE = "1");
afterEach(() => {
  delete process.env.DEMO_MODE;
});

describe("demo mode", () => {
  it("logs in with the password only; off, 2FA is asked as always", async () => {
    const { user, password } = await makeUser();
    expect(await login(user.email, password, ctx)).toMatchObject({ ok: true, next: "/login/2fa" });
    on();
    expect(await login(user.email, password, ctx)).toMatchObject({ ok: true, next: "/" });
    expect(await db.auditLog.findFirst({ where: { actorUserId: user.id, action: "auth.login.success" } })).toMatchObject({ details: { method: "demo_password_only" } });
  });

  it("sends no e-mail and stores no files", async () => {
    on();
    const to = `demo-${Date.now()}@example.com`;
    await sendMail(to, "x", "x", "x");
    expect(await lastMailTo(to)).toBeNull();
    const c = await companies();
    const sec = await makeActor("USER", [c.surgery], "SECRETARY");
    const p = await makePatient(c.surgery, { surname: `Δοκιμή ${Date.now()}` });
    expect(await uploadDocuments(sec, p.id, [{ name: "a.pdf", bytes: Buffer.from("%PDF-1.4") }], {}, ctx)).toEqual({ ok: false, error: "demo" });
  });
});

describe("«💬 Πρόταση»", () => {
  it("saved with screen, user and time; Owners read, tick done, export Markdown", async () => {
    const c = await companies();
    const sec = await makeActor("USER", [c.surgery], "SECRETARY");
    const owner = await makeActor("OWNER", [c.surgery], "SURGEON");
    const input = { screen: "Ημερολόγιο", path: "/calendar?date=2026-10-13", text: `Μεγαλύτερα γράμματα ${Date.now()}` };
    expect(await addSuggestion(sec, c.surgery, input, ctx)).toMatchObject({ ok: false }); // not a demo
    on();
    expect(await addSuggestion(sec, c.surgery, { ...input, text: "  " }, ctx)).toEqual({ ok: false, error: "empty" });
    expect(await addSuggestion(sec, c.surgery, input, ctx)).toEqual({ ok: true });
    expect(await listSuggestions(sec)).toBeNull(); // only Owners/Admins read them
    const row = (await listSuggestions(owner, "open"))!.find((r) => r.text === input.text)!;
    expect(row).toMatchObject({ screen: "Ημερολόγιο", path: input.path, userName: sec.name, doneAt: null });
    expect(await setSuggestionDone(sec, row.id, true, ctx)).toMatchObject({ ok: false });
    expect(await setSuggestionDone(owner, row.id, true, ctx)).toEqual({ ok: true });
    expect((await listSuggestions(owner, "open"))!.some((r) => r.id === row.id)).toBe(false);
    expect((await listSuggestions(owner, "done"))!.some((r) => r.id === row.id)).toBe(true);
    const md = (await suggestionsMarkdown(owner, "all", ctx))!;
    expect(md).toContain("## Ημερολόγιο");
    expect(md).toContain(`- [x] ${input.text}`);
    expect(md).toContain(`— ${sec.name}`);
  });
});
