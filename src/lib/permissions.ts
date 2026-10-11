import type { Level } from "@/generated/prisma/client";

// Who may manage whom (SPEC §11). Pure functions so the rules are easy to test.

const rank: Record<Level, number> = { GUEST: 0, USER: 1, ADMIN: 2, OWNER: 3 };

export function canManageUsers(actor: Level): boolean {
  return actor === "OWNER" || actor === "ADMIN";
}

// Owners may grant any level; Admins up to Admin.
export function canAssignLevel(actor: Level, level: Level): boolean {
  if (actor === "OWNER") return true;
  if (actor === "ADMIN") return rank[level] <= rank.ADMIN;
  return false;
}

// Editing details (name, company access). Nobody below Owner may edit an Owner.
export function canManageUser(actor: Level, target: Level): boolean {
  if (!canManageUsers(actor)) return false;
  return target !== "OWNER" || actor === "OWNER";
}

// Deleting or deactivating. Owners can never be removed in the app, not even by an Owner.
export function canRemoveUser(actor: Level, target: Level): boolean {
  return canManageUsers(actor) && target !== "OWNER";
}

// Demoting an Owner counts as removing one, so it is not allowed either.
export function canChangeLevel(actor: Level, target: Level, newLevel: Level): boolean {
  if (target === "OWNER" && newLevel !== "OWNER") return false;
  return canManageUser(actor, target) && canAssignLevel(actor, newLevel);
}

export function isReadOnly(level: Level): boolean {
  return level === "GUEST";
}

// Guests must have an end date; it is ignored for other levels.
export function hasExpired(user: { level: Level; accessExpiresAt: Date | null }, now = new Date()) {
  return user.level === "GUEST" && (!user.accessExpiresAt || user.accessExpiresAt <= now);
}
