"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COMPANY_COOKIE } from "@/lib/company";
import { loadActor } from "@/lib/users/manage";
import { revokeSession } from "@/lib/auth/sessions";
import { clearSessionCookie, getCurrentSession, requestContext } from "@/lib/auth/current";

export async function logoutAction() {
  const session = await getCurrentSession();
  if (session) await revokeSession(session.sessionId, session.user, "logout", await requestContext());
  await clearSessionCookie();
  redirect("/login");
}

// The Ιατρείο | Spa switch. Only the user's own companies are accepted.
export async function switchCompanyAction(fd: FormData) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const actor = await loadActor(session.user.id);
  const companyId = String(fd.get("companyId") ?? "");
  if (actor.companyIds.includes(companyId)) {
    (await cookies()).set(COMPANY_COOKIE, companyId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  }
  revalidatePath("/", "layout");
}
