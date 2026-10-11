import { describe, expect, it } from "vitest";
import {
  canArchivePatients,
  canAssignLevel,
  canChangeLevel,
  canManageUser,
  canManageUsers,
  canEditPatients,
  canRemoveUser,
  canSeeContactDetails,
  hasExpired,
  isReadOnly,
  resolveCompanyAccess,
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

  it("lets Admins grant only their own companies; Owners any", () => {
    const admin = { level: "ADMIN" as const, companyIds: ["spa"] };
    expect(resolveCompanyAccess(admin, [], ["spa", "surgery"])).toEqual(["spa"]);
    // An existing Surgery access the admin cannot manage is kept, not removed.
    expect(resolveCompanyAccess(admin, ["surgery", "spa"], []).sort()).toEqual(["surgery"]);
    expect(resolveCompanyAccess({ level: "OWNER", companyIds: [] }, ["spa"], ["surgery"])).toEqual(["surgery"]);
  });

  it("hides contact details from Guests and keeps them read-only", () => {
    for (const level of ["OWNER", "ADMIN", "USER"] as const) {
      expect(canSeeContactDetails(level)).toBe(true);
      expect(canEditPatients(level)).toBe(true);
    }
    expect(canSeeContactDetails("GUEST")).toBe(false);
    expect(canEditPatients("GUEST")).toBe(false);
  });

  it("lets only Owners archive patients", () => {
    expect(canArchivePatients("OWNER")).toBe(true);
    for (const level of ["ADMIN", "USER", "GUEST"] as const) expect(canArchivePatients(level)).toBe(false);
  });
});
