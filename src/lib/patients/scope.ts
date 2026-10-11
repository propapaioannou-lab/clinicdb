import type { Actor } from "@/lib/users/manage";

// Only the companies the user belongs to; a requested company outside them gives nothing.
export function companyFilter(actor: Actor, companyId?: string): string[] {
  if (!companyId) return actor.companyIds;
  return actor.companyIds.includes(companyId) ? [companyId] : [];
}
