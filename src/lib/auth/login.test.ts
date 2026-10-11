import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { ctx, makeUser } from "../../../test/factories";
import { fullLogin } from "../../../test/login-helpers";
import { login, MAX_FAILED_LOGINS } from "./login";
import { revokeSession, validatePendingSession, validateSession } from "./sessions";

const actions = async (userId: string) =>
  (await db.auditLog.findMany({ where: { actorUserId: userId }, orderBy: { id: "asc" } })).map((a) => a.action);

describe("login", () => {
  it("right password gives only a short pending session that needs the 2FA code", async () => {
    const { user, password } = await makeUser();
    const r = await login(user.email.toUpperCase(), password, ctx);
    expect(r).toMatchObject({ ok: true, next: "/login/2fa" });
    if (!r.ok) return;
    expect(await validateSession(r.token)).toBeNull();
    expect((await validatePendingSession(r.token))?.user.id).toBe(user.id);
    expect(r.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(10 * 60 * 1000);
    expect(await actions(user.id)).toEqual(["auth.login.password_ok"]);
    // Only the hash of the token is stored.
    expect(await db.session.count({ where: { tokenHash: r.token } })).toBe(0);
  });

  it("sends users without 2FA to the setup page", async () => {
    const { user, password } = await makeUser({ totp: false });
    expect(await login(user.email, password, ctx)).toMatchObject({ ok: true, next: "/login/setup-2fa" });
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
    const { user, password, totpSecret } = await makeUser();
    await db.user.update({ where: { id: user.id }, data: { lockedUntil: new Date(Date.now() - 1000), failedLogins: 3 } });
    await fullLogin(user.email, password, totpSecret!);
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
    const { user, password, totpSecret } = await makeUser();
    const sunday = new Date("2026-10-11T07:00:00Z");
    const token = await fullLogin(user.email, password, totpSecret!, sunday);
    const v = await validateSession(token, sunday);
    expect(v?.expiresAt.toISOString()).toBe("2026-10-12T02:00:00.000Z");
    expect(await validateSession(token, new Date("2026-10-12T01:59:00Z"))).not.toBeNull();
    expect(await validateSession(token, new Date("2026-10-12T02:00:00Z"))).toBeNull();
  });

  it("stop working when revoked (logout), and the revoke is audited", async () => {
    const { user, password, totpSecret } = await makeUser();
    const token = await fullLogin(user.email, password, totpSecret!);
    const v = await validateSession(token);
    await revokeSession(v!.sessionId, v!.user, "logout", ctx);
    expect(await validateSession(token)).toBeNull();
    expect(await actions(user.id)).toContain("auth.session.revoked");
  });

  it("stop working when the user is deactivated or a Guest's end date passes", async () => {
    const a = await makeUser();
    const ta = await fullLogin(a.user.email, a.password, a.totpSecret!);
    await db.user.update({ where: { id: a.user.id }, data: { isActive: false } });
    expect(await validateSession(ta)).toBeNull();

    const end = new Date(Date.now() + 60 * 60 * 1000);
    const g = await makeUser({ level: "GUEST", accessExpiresAt: end });
    const tg = await fullLogin(g.user.email, g.password, g.totpSecret!);
    expect(await validateSession(tg)).not.toBeNull();
    expect(await validateSession(tg, new Date(end.getTime() + 1))).toBeNull();
  });

  it("reject made-up tokens", async () => {
    expect(await validateSession("made-up-token")).toBeNull();
    expect(await validateSession(undefined)).toBeNull();
  });
});
