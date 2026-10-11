"use server";

import { redirect } from "next/navigation";
import { revokeSession } from "@/lib/auth/sessions";
import { clearSessionCookie, getCurrentSession, requestContext } from "@/lib/auth/current";

export async function logoutAction() {
  const session = await getCurrentSession();
  if (session) await revokeSession(session.sessionId, session.user, "logout", await requestContext());
  await clearSessionCookie();
  redirect("/login");
}
