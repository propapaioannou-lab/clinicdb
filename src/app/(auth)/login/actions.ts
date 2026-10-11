"use server";

import { redirect } from "next/navigation";
import { login, LOCK_MINUTES } from "@/lib/auth/login";
import { requestContext, setSessionCookie } from "@/lib/auth/current";

export type LoginState = {
  email: string;
  error?: "invalid" | "locked" | "inactive" | "expired" | "missing";
  minutes?: number;
};

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { email, error: "missing" };

  const result = await login(email, password, await requestContext());
  if (!result.ok) {
    const minutes = result.lockedUntil
      ? Math.max(1, Math.ceil((result.lockedUntil.getTime() - Date.now()) / 60000))
      : LOCK_MINUTES;
    return { email, error: result.reason, minutes };
  }
  await setSessionCookie(result.token, result.expiresAt);
  redirect("/");
}
