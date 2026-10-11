import type { Level, Role } from "@/generated/prisma/client";

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

// Owners may grant any company; Admins only companies they have themselves.
// Returns the final company list: requested changes inside the actor's reach,
// everything outside it left as it was.
export function resolveCompanyAccess(
  actor: { level: Level; companyIds: string[] },
  current: string[],
  requested: string[],
): string[] {
  if (actor.level === "OWNER") return [...new Set(requested)];
  const reach = new Set(actor.companyIds);
  const kept = current.filter((c) => !reach.has(c));
  const granted = requested.filter((c) => reach.has(c));
  return [...new Set([...kept, ...granted])];
}

// Guests (research) never see phones, emails, address, AMKA, ΑΦΜ or date of birth (SPEC §11).
export function canSeeContactDetails(level: Level): boolean {
  return level !== "GUEST";
}

export function canEditPatients(level: Level): boolean {
  return !isReadOnly(level);
}

// Archiving hides a patient everywhere; only an Owner may do it or undo it.
export function canArchivePatients(level: Level): boolean {
  return level === "OWNER";
}

// HIV, hepatitis, substance use, mental health (decided 11 Oct 2026): only the clinical
// and front-desk roles — Surgeon, PA/nurse, Secretary. Not spa staff, "Other" or Guests.
export function canSeeSensitiveHistory(user: { level: Level; role: Role }): boolean {
  return user.level !== "GUEST" && (user.role === "SURGEON" || user.role === "PA_NURSE" || user.role === "SECRETARY");
}
