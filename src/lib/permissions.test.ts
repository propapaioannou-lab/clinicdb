import { describe, expect, it } from "vitest";
import {
  canAssignLevel,
  canChangeLevel,
  canManageUser,
  canManageUsers,
  canRemoveUser,
  hasExpired,
  isReadOnly,
} from "./permissions";

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

  it("never lets anyone remove or demote an Owner, not even an Owner", () => {
    expect(canRemoveUser("OWNER", "OWNER")).toBe(false);
    expect(canRemoveUser("ADMIN", "OWNER")).toBe(false);
    expect(canChangeLevel("OWNER", "OWNER", "ADMIN")).toBe(false);
    expect(canChangeLevel("OWNER", "OWNER", "GUEST")).toBe(false);
  });

  it("lets Owner and Admin remove and re-level everyone else", () => {
    expect(canRemoveUser("OWNER", "ADMIN")).toBe(true);
    expect(canRemoveUser("ADMIN", "ADMIN")).toBe(true);
    expect(canRemoveUser("ADMIN", "GUEST")).toBe(true);
    expect(canRemoveUser("USER", "GUEST")).toBe(false);
    expect(canChangeLevel("OWNER", "ADMIN", "OWNER")).toBe(true);
    expect(canChangeLevel("ADMIN", "USER", "ADMIN")).toBe(true);
    expect(canChangeLevel("ADMIN", "USER", "OWNER")).toBe(false);
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
