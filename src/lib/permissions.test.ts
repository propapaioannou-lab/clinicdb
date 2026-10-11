import { describe, expect, it } from "vitest";
import { canAssignLevel, canManageUser, canManageUsers, hasExpired, isReadOnly } from "./permissions";

describe("permissions", () => {
  it("lets only Owner and Admin manage users", () => {
    expect(canManageUsers("OWNER")).toBe(true);
    expect(canManageUsers("ADMIN")).toBe(true);
    expect(canManageUsers("USER")).toBe(false);
    expect(canManageUsers("GUEST")).toBe(false);
  });

  it("lets Admins grant up to Admin, and only Owners grant Owner", () => {
    expect(canAssignLevel("ADMIN", "ADMIN")).toBe(true);
    expect(canAssignLevel("ADMIN", "GUEST")).toBe(true);
    expect(canAssignLevel("ADMIN", "OWNER")).toBe(false);
    expect(canAssignLevel("OWNER", "OWNER")).toBe(true);
    expect(canAssignLevel("USER", "GUEST")).toBe(false);
  });

  it("protects Owners from everyone but Owners", () => {
    expect(canManageUser("ADMIN", "OWNER")).toBe(false);
    expect(canManageUser("ADMIN", "ADMIN")).toBe(true);
    expect(canManageUser("OWNER", "OWNER")).toBe(true);
    expect(canManageUser("USER", "GUEST")).toBe(false);
  });

  it("makes Guests read-only and expires them on their end date", () => {
    const now = new Date("2026-10-11T12:00:00Z");
    expect(isReadOnly("GUEST")).toBe(true);
    expect(isReadOnly("USER")).toBe(false);
    expect(hasExpired({ level: "GUEST", accessExpiresAt: new Date("2026-10-11T11:59:59Z") }, now)).toBe(true);
    expect(hasExpired({ level: "GUEST", accessExpiresAt: new Date("2026-12-01T00:00:00Z") }, now)).toBe(false);
    expect(hasExpired({ level: "GUEST", accessExpiresAt: null }, now)).toBe(true);
    expect(hasExpired({ level: "USER", accessExpiresAt: null }, now)).toBe(false);
  });
});
