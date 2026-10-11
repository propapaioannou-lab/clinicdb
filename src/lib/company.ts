import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import type { Actor } from "@/lib/users/manage";

// Which company the user is working in now (the Ιατρείο | Spa switch). Remembered per
// browser; always one of the user's own companies. Surgery first by default.
export const COMPANY_COOKIE = "clinic_company";

export const userCompanies = cache(async (companyIds: string[]) =>
  db.company.findMany({ where: { id: { in: companyIds } }, orderBy: { code: "desc" } }),
);

export async function activeCompany(actor: Actor) {
  const companies = await userCompanies(actor.companyIds);
  const wanted = (await cookies()).get(COMPANY_COOKIE)?.value;
  return companies.find((c) => c.id === wanted) ?? companies[0] ?? null;
}
