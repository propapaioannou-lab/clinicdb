import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { ctx, makeUser } from "../../test/factories";
import { audit } from "./audit";
import { queryAudit } from "./audit-query";

describe("audit log", () => {
  it("cannot be changed, deleted or emptied — not even by the app", async () => {
    const { user } = await makeUser();
    await audit({ action: "test.entry", actor: user }, ctx);
    const entry = await db.auditLog.findFirstOrThrow({ where: { actorUserId: user.id } });
    await expect(db.auditLog.update({ where: { id: entry.id }, data: { action: "tampered" } })).rejects.toThrow(/append-only/);
    await expect(db.auditLog.delete({ where: { id: entry.id } })).rejects.toThrow(/append-only/);
    await expect(db.auditLog.deleteMany({})).rejects.toThrow(/append-only/);
    await expect(db.$executeRawUnsafe('TRUNCATE "AuditLog"')).rejects.toThrow(/append-only/);
    expect((await db.auditLog.findUniqueOrThrow({ where: { id: entry.id } })).action).toBe("test.entry");
  });

  it("filters by person (as actor or target), action group and date, newest first, with paging", async () => {
    const a = await makeUser();
    const b = await makeUser();
    await audit({ action: "auth.login.success", actor: a.user }, ctx);
    await audit({ action: "user.updated", actor: a.user, entityType: "User", entityId: b.user.id, details: { name: { from: "x", to: "y" } } }, ctx);
    await audit({ action: "auth.login.failure", actor: b.user, details: { reason: "wrong_password" } }, ctx);

    const forB = await queryAudit({ userId: b.user.id });
    expect(forB.entries.map((e) => e.action)).toEqual(["auth.login.failure", "user.updated"]);
    expect(forB.entries[1].target?.name).toBe(b.user.name);
    expect(forB.entries[1].actor?.name).toBe(a.user.name);

    expect((await queryAudit({ userId: a.user.id, group: "users" })).entries.map((e) => e.action)).toEqual(["user.updated"]);
    expect((await queryAudit({ userId: b.user.id, group: "failures" })).entries).toHaveLength(1);
    expect((await queryAudit({ userId: a.user.id, to: new Date(Date.now() - 60_000) })).entries).toHaveLength(0);

    const firstPage = await queryAudit({ userId: a.user.id });
    const older = await queryAudit({ userId: a.user.id, before: BigInt(firstPage.entries[0].id) });
    expect(older.entries.map((e) => e.action)).toEqual(["auth.login.success"]);
  });

  it("shows deleted users by name", async () => {
    const { user } = await makeUser();
    await audit({ action: "auth.login.success", actor: user }, ctx);
    await db.deletedUser.create({
      data: { userId: user.id, email: user.email, name: user.name, level: "USER", companies: [], createdAt: user.createdAt, deletedById: "x", deletedByEmail: "x@example.com" },
    });
    await db.user.delete({ where: { id: user.id } });
    const r = await queryAudit({ userId: user.id });
    expect(r.entries[0].actor).toMatchObject({ name: user.name, deleted: true });
  });
});
