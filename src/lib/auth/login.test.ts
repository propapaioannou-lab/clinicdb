import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { ctx, makeUser } from "../../../test/factories";
import { login, MAX_FAILED_LOGINS } from "./login";
import { revokeSession, validateSession } from "./sessions";

const actions = async (userId: string) =>
  (await db.auditLog.findMany({ where: { actorUserId: userId }, orderBy: { id: "asc" } })).map((a) => a.action);

describe("login", () => {
  it("logs in with the right password, creates a session and audits it", async () => {
    const { user, password } = await makeUser();
    const r = await login(user.email.toUpperCase(), password, ctx);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const v = await validateSession(r.token);
    expect(v?.user.id).toBe(user.id);
    expect(await actions(user.id)).toEqual(["auth.login.success"]);
    // Only the hash of the token is stored.
    expect(await db.session.count({ where: { tokenHash: r.token } })).toBe(0);
  });

  it("rejects a wrong password and audits it", async () => {
    const { user } = await makeUser();
    expect(await login(user.email, "wrong-password-1", ctx)).toEqual({ ok: false, reason: "invalid" });
    expect(await actions(user.id)).toEqual(["auth.login.failure"]);
  });

  it("gives the same answer for an unknown email and audits the attempt", async () => {
    expect(await login("nobody@example.com", "whatever-123", ctx)).toEqual({ ok: false, reason: "invalid" });
    expect(await db.auditLog.count({ where: { actorEmail: "nobody@example.com", action: "auth.login.failure" } })).toBe(1);
  });

  it(`locks the account after ${MAX_FAILED_LOGINS} wrong passwords, even for the right one`, async () => {
    const { user, password } = await makeUser();
    for (let i = 1; i < MAX_FAILED_LOGINS; i++) {
      expect((await login(user.email, "wrong-password-1", ctx)).ok).toBe(false);
    }
    const locked = await login(user.email, "wrong-password-1", ctx);
    expect(locked).toMatchObject({ ok: false, reason: "locked" });
    expect(await login(user.email, password, ctx)).toMatchObject({ ok: false, reason: "locked" });
    expect(await actions(user.id)).toContain("auth.login.locked");
  });

  it("unlocks after the lock time and resets the counter on success", async () => {
    const { user, password } = await makeUser();
    await db.user.update({ where: { id: user.id }, data: { lockedUntil: new Date(Date.now() - 1000), failedLogins: 3 } });
    expect((await login(user.email, password, ctx)).ok).toBe(true);
    const after = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.failedLogins).toBe(0);
    expect(after.lockedUntil).toBeNull();
    expect(after.lastLoginAt).not.toBeNull();
  });

  it("refuses inactive users and Guests past their end date", async () => {
    const inactive = await makeUser({ isActive: false });
    expect(await login(inactive.user.email, inactive.password, ctx)).toEqual({ ok: false, reason: "inactive" });
    const guest = await makeUser({ level: "GUEST", accessExpiresAt: new Date(Date.now() - 1000) });
    expect(await login(guest.user.email, guest.password, ctx)).toEqual({ ok: false, reason: "expired" });
  });
});

describe("sessions", () => {
  it("expire on Monday 05:00 Athens", async () => {
    const { user, password } = await makeUser();
    const sunday = new Date("2026-10-11T07:00:00Z");
    const r = await login(user.email, password, ctx, sunday);
    if (!r.ok) throw new Error("login failed");
    expect(r.expiresAt.toISOString()).toBe("2026-10-12T02:00:00.000Z");
    expect(await validateSession(r.token, new Date("2026-10-12T01:59:00Z"))).not.toBeNull();
    expect(await validateSession(r.token, new Date("2026-10-12T02:00:00Z"))).toBeNull();
  });

  it("stop working when revoked (logout), and the revoke is audited", async () => {
    const { user, password } = await makeUser();
    const r = await login(user.email, password, ctx);
    if (!r.ok) throw new Error("login failed");
    const v = await validateSession(r.token);
    await revokeSession(v!.sessionId, v!.user, "logout", ctx);
    expect(await validateSession(r.token)).toBeNull();
    expect(await actions(user.id)).toContain("auth.session.revoked");
  });

  it("stop working when the user is deactivated or a Guest's end date passes", async () => {
    const a = await makeUser();
    const ra = await login(a.user.email, a.password, ctx);
    if (!ra.ok) throw new Error("login failed");
    await db.user.update({ where: { id: a.user.id }, data: { isActive: false } });
    expect(await validateSession(ra.token)).toBeNull();

    const end = new Date(Date.now() + 60 * 60 * 1000);
    const g = await makeUser({ level: "GUEST", accessExpiresAt: end });
    const rg = await login(g.user.email, g.password, ctx);
    if (!rg.ok) throw new Error("login failed");
    expect(await validateSession(rg.token)).not.toBeNull();
    expect(await validateSession(rg.token, new Date(end.getTime() + 1))).toBeNull();
  });

  it("reject made-up tokens", async () => {
    expect(await validateSession("made-up-token")).toBeNull();
    expect(await validateSession(undefined)).toBeNull();
  });
});
