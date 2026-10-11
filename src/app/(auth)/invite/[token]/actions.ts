"use server";

import { redirect } from "next/navigation";
import { requestContext, setSessionCookie } from "@/lib/auth/current";
import { acceptInvitation } from "@/lib/users/invitations";

export type InviteState = { error?: "too_short" | "mismatch" | "invalid_link" };

export async function acceptInviteAction(token: string, _prev: InviteState, formData: FormData): Promise<InviteState> {
  const password = String(formData.get("password") ?? "");
  if (password !== String(formData.get("repeat") ?? "")) return { error: "mismatch" };
  const r = await acceptInvitation(token, password, await requestContext());
  if (!r.ok) return { error: r.reason };
  await setSessionCookie(r.token, r.expiresAt);
  redirect("/login/setup-2fa");
}
