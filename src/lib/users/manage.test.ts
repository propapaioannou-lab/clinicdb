import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { login } from "@/lib/auth/login";
import { validatePendingSession, validateSession } from "@/lib/auth/sessions";
import { companies, ctx, lastMailTo, makeActor, makeUser } from "../../../test/factories";
import { fullLogin } from "../../../test/login-helpers";
import { acceptInvitation, findValidInvitation, INVITE_HOURS } from "./invitations";
import {
  createUser,
  deleteUser,
  endSession,
  generatePasswordFor,
  removeTrustedDevice,
  reactivateUser,
  resendInvitation,
  suspendUser,
  updateUser,
} from "./manage";

let c: { surgery: string; spa: string };
beforeAll(async () => {
  c = await companies();
});

const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const base = (over: Partial<Parameters<typeof createUser>[1]> = {}) => ({
  email: `new-${uniq()}@example.com`,
  name: "Νέος Χρήστης",
  level: "USER" as const,
  role: "OTHER" as const,
  companyIds: [c.surgery],
  accessExpiresAt: null,
  method: "invite" as const,
  ...over,
});
const inDays = (d: number) => new Date(Date.now() + d * 86400000);
const linkToken = (text: string) => /\/invite\/([A-Za-z0-9_-]+)/.exec(text)?.[1];

describe("invitations", () => {
  it("emails a link; the link sets the password once and leads to 2FA setup", async () => {
    const owner = await makeActor("OWNER", [c.surgery, c.spa]);
    const input = base();
    const r = await createUser(owner, input, ctx);
    expect(r).toMatchObject({ ok: true, mailFailed: false });

    const mail = await lastMailTo(input.email);
    expect(mail?.subject).toBe("Πρόσκληση στο Αρχείο Ασθενών");
    expect(mail?.text).toContain(owner.name);
    expect(mail?.text).toContain(`${INVITE_HOURS} ώρες`);
    const token = linkToken(mail!.text)!;

    // Cannot log in before accepting.
    expect(await login(input.email, "anything-long-1", ctx)).toMatchObject({ ok: false, reason: "invalid" });
    expect(await acceptInvitation(token, "short", ctx)).toEqual({ ok: false, reason: "too_short" });

    const a = await acceptInvitation(token, "my-own-password-1", ctx);
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    expect((await validatePendingSession(a.token))?.stage).toBe("PENDING_ENROLL");
    expect(await acceptInvitation(token, "another-password-1", ctx)).toEqual({ ok: false, reason: "invalid_link" });
    expect(await login(input.email, "my-own-password-1", ctx)).toMatchObject({ ok: true, next: "/login/setup-2fa" });
  });

  it("expires after 72 hours, and a re-sent link replaces the old one", async () => {
    const owner = await makeActor("OWNER", [c.surgery]);
    const input = base();
    const r = await createUser(owner, input, ctx);
    if (!r.ok) throw new Error(r.error);
    const first = linkToken((await lastMailTo(input.email))!.text)!;
    expect(await findValidInvitation(first, inDays(2.9))).not.toBeNull();
    expect(await findValidInvitation(first, inDays(3.1))).toBeNull();

    await new Promise((res) => setTimeout(res, 50));
    expect(await resendInvitation(owner, r.userId, ctx)).toMatchObject({ ok: true, mailFailed: false });
    const second = linkToken((await lastMailTo(input.email))!.text)!;
    expect(second).not.toBe(first);
    expect(await findValidInvitation(first)).toBeNull();
    expect(await findValidInvitation(second)).not.toBeNull();
  });
});

describe("creating users", () => {
  it("with a generated permanent password instead of an email", async () => {
    const admin = await makeActor("ADMIN", [c.surgery]);
    const input = base({ method: "password" });
    const r = await createUser(admin, input, ctx);
    if (!r.ok || !r.password) throw new Error("no password");
    expect(r.password).toMatch(/^.{4}-.{4}-.{4}-.{4}$/);
    expect(await login(input.email, r.password, ctx)).toMatchObject({ ok: true, next: "/login/setup-2fa" });
  });

  it("Admins can create Admins but not Owners; Users and Guests cannot create anyone", async () => {
    const admin = await makeActor("ADMIN", [c.surgery]);
    expect((await createUser(admin, base({ level: "ADMIN", method: "password" }), ctx)).ok).toBe(true);
    expect(await createUser(admin, base({ level: "OWNER" }), ctx)).toEqual({ ok: false, error: "forbidden" });
    const user = await makeActor("USER", [c.surgery]);
    expect(await createUser(user, base(), ctx)).toEqual({ ok: false, error: "forbidden" });
  });

  it("Admins only give access to their own companies", async () => {
    const spaAdmin = await makeActor("ADMIN", [c.spa]);
    const r = await createUser(spaAdmin, base({ companyIds: [c.spa, c.surgery], method: "password" }), ctx);
    if (!r.ok) throw new Error(r.error);
    const m = await db.membership.findMany({ where: { userId: r.userId } });
    expect(m.map((x) => x.companyId)).toEqual([c.spa]);
    expect(await createUser(spaAdmin, base({ companyIds: [c.surgery] }), ctx)).toEqual({ ok: false, error: "no_company" });
  });

  it("checks Guest end dates, emails and duplicates", async () => {
    const owner = await makeActor("OWNER", [c.surgery]);
    expect(await createUser(owner, base({ level: "GUEST" }), ctx)).toEqual({ ok: false, error: "guest_needs_end_date" });
    expect(await createUser(owner, base({ level: "GUEST", accessExpiresAt: inDays(-1) }), ctx)).toEqual({ ok: false, error: "guest_needs_end_date" });
    expect((await createUser(owner, base({ level: "GUEST", accessExpiresAt: inDays(90), method: "password" }), ctx)).ok).toBe(true);
    expect(await createUser(owner, base({ email: "not-an-email" }), ctx)).toEqual({ ok: false, error: "invalid_email" });
    const dup = base({ method: "password" });
    await createUser(owner, dup, ctx);
    expect(await createUser(owner, { ...dup, email: dup.email.toUpperCase() }, ctx)).toEqual({ ok: false, error: "email_taken" });
  });
});

describe("editing users", () => {
  const edit = (level: "OWNER" | "ADMIN" | "USER" | "GUEST", companyIds?: string[]) => ({
    name: "Edited",
    level,
    role: "PA_NURSE" as const,
    companyIds: companyIds ?? [c.surgery],
    accessExpiresAt: level === "GUEST" ? inDays(30) : null,
  });

  it("Owners are protected: nobody deactivates, demotes or deletes them; Admins cannot even edit them", async () => {
    const owner = await makeActor("OWNER", [c.surgery]);
    const owner2 = await makeActor("OWNER", [c.surgery]);
    const admin = await makeActor("ADMIN", [c.surgery]);
    expect(await suspendUser(owner, owner2.id, ctx)).toEqual({ ok: false, error: "forbidden" });
    expect(await updateUser(owner, owner2.id, edit("ADMIN"), ctx)).toEqual({ ok: false, error: "forbidden" });
    expect(await deleteUser(owner, owner2.id, ctx)).toEqual({ ok: false, error: "forbidden" });
    expect(await updateUser(admin, owner2.id, edit("OWNER"), ctx)).toEqual({ ok: false, error: "forbidden" });
    expect(await updateUser(owner, owner2.id, edit("OWNER"), ctx)).toEqual({ ok: true }); // rename is fine
  });

  it("nobody can deactivate, demote or delete themselves", async () => {
    const admin = await makeActor("ADMIN", [c.surgery]);
    expect(await suspendUser(admin, admin.id, ctx)).toEqual({ ok: false, error: "self" });
    expect(await updateUser(admin, admin.id, edit("USER"), ctx)).toEqual({ ok: false, error: "self" });
    expect(await deleteUser(admin, admin.id, ctx)).toEqual({ ok: false, error: "self" });
  });

  it("records what changed in the audit log", async () => {
    const owner = await makeActor("OWNER", [c.surgery, c.spa]);
    const { user } = await makeUser();
    await db.membership.create({ data: { userId: user.id, companyId: c.surgery } });
    expect(await updateUser(owner, user.id, edit("GUEST", [c.spa]), ctx)).toEqual({ ok: true });
    const entry = await db.auditLog.findFirstOrThrow({ where: { entityId: user.id, action: "user.updated" } });
    expect(entry.details).toMatchObject({ level: { from: "USER", to: "GUEST" }, companyIds: { from: [c.surgery], to: [c.spa] } });
  });

  it("suspending logs the person out and blocks login; reactivating restores it", async () => {
    const admin = await makeActor("ADMIN", [c.surgery]);
    const { user, password, totpSecret } = await makeUser();
    const token = await fullLogin(user.email, password, totpSecret!);
    expect(await suspendUser(admin, user.id, ctx)).toEqual({ ok: true });
    expect(await validateSession(token)).toBeNull();
    expect(await login(user.email, password, ctx)).toMatchObject({ ok: false, reason: "inactive" });
    expect(await reactivateUser(admin, user.id, ctx)).toEqual({ ok: true });
    expect((await login(user.email, password, ctx)).ok).toBe(true);
  });

  it("deleting is permanent but keeps a record and the audit history", async () => {
    const owner = await makeActor("OWNER", [c.surgery]);
    const { user } = await makeUser();
    await db.membership.create({ data: { userId: user.id, companyId: c.surgery } });
    await db.auditLog.create({ data: { action: "test.something", actorUserId: user.id, actorEmail: user.email } });
    expect(await deleteUser(owner, user.id, ctx)).toEqual({ ok: true });
    expect(await db.user.findUnique({ where: { id: user.id } })).toBeNull();
    const record = await db.deletedUser.findUniqueOrThrow({ where: { userId: user.id } });
    expect(record).toMatchObject({ email: user.email, name: user.name, companies: ["Surgery"], deletedByEmail: owner.email });
    expect(await db.auditLog.count({ where: { actorUserId: user.id } })).toBe(1);
    expect(await db.auditLog.count({ where: { entityId: user.id, action: "user.deleted" } })).toBe(1);
    // The same email can be invited again later.
    expect((await createUser(owner, base({ email: user.email, method: "password" }), ctx)).ok).toBe(true);
  });
});

describe("passwords and devices", () => {
  it("a generated password ends the person's open logins", async () => {
    const admin = await makeActor("ADMIN", [c.surgery]);
    const { user, password, totpSecret } = await makeUser();
    const token = await fullLogin(user.email, password, totpSecret!);
    const r = await generatePasswordFor(admin, user.id, ctx);
    if (!r.ok) throw new Error(r.error);
    expect(await validateSession(token)).toBeNull();
    expect((await login(user.email, r.password, ctx)).ok).toBe(true);
  });

  it("admins end other people's sessions and trusted devices; users only their own", async () => {
    const admin = await makeActor("ADMIN", [c.surgery]);
    const other = await makeActor("USER", [c.surgery]);
    const { user, password, totpSecret } = await makeUser();
    const token = await fullLogin(user.email, password, totpSecret!);
    const s = (await validateSession(token))!;
    expect(await endSession(other, s.sessionId, ctx)).toEqual({ ok: false, error: "forbidden" });
    expect(await endSession(admin, s.sessionId, ctx)).toEqual({ ok: true });
    expect(await validateSession(token)).toBeNull();

    const device = await db.trustedDevice.create({
      data: { userId: user.id, tokenHash: `t-${uniq()}`, expiresAt: inDays(90) },
    });
    expect(await removeTrustedDevice(other, device.id, ctx)).toEqual({ ok: false, error: "forbidden" });
    expect(await removeTrustedDevice(admin, device.id, ctx)).toEqual({ ok: true });
    expect((await db.trustedDevice.findUniqueOrThrow({ where: { id: device.id } })).revokedAt).not.toBeNull();
  });

  it("sets and changes the role, and logs the change", async () => {
    const admin = await makeActor("ADMIN", [c.surgery]);
    const r = await createUser(admin, base({ role: "SECRETARY", method: "password" }), ctx);
    expect(r.ok).toBe(true);
    const u = await db.user.findFirstOrThrow({ where: { role: "SECRETARY" }, orderBy: { createdAt: "desc" } });
    expect((await updateUser(admin, u.id, { name: u.name, level: "USER", role: "PA_NURSE", companyIds: [c.surgery], accessExpiresAt: null }, ctx)).ok).toBe(true);
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).role).toBe("PA_NURSE");
    const log = await db.auditLog.findFirstOrThrow({ where: { action: "user.updated", entityId: u.id } });
    expect(log.details).toMatchObject({ role: { from: "SECRETARY", to: "PA_NURSE" } });
  });
});
