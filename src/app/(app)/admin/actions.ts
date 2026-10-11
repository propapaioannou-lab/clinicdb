"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Level } from "@/generated/prisma/client";
import { requestContext } from "@/lib/auth/current";
import { endOfAthensDay } from "@/lib/time";
import {
  createUser,
  deleteUser,
  endAllSessions,
  endSession,
  generatePasswordFor,
  removeTrustedDevice,
  resendInvitation,
  resetTwoFactorFor,
  unlockUser,
  updateUser,
  type ManageError,
} from "@/lib/users/manage";
import { requireManager } from "./guard";

export type FormState = { error?: ManageError; saved?: boolean; password?: string; email?: string };

const LEVELS: Level[] = ["OWNER", "ADMIN", "USER", "GUEST"];

function readUserFields(fd: FormData) {
  const level = String(fd.get("level")) as Level;
  return {
    name: String(fd.get("name") ?? ""),
    level: LEVELS.includes(level) ? level : "USER",
    companyIds: fd.getAll("company").map(String),
    accessExpiresAt: endOfAthensDay(String(fd.get("guestEnd") ?? "")),
  };
}

export async function createUserAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { actor } = await requireManager();
  const method = fd.get("method") === "password" ? "password" : "invite";
  const email = String(fd.get("email") ?? "");
  const r = await createUser(actor, { ...readUserFields(fd), email, method }, await requestContext());
  if (!r.ok) return { error: r.error };
  revalidatePath("/admin/users");
  if (r.password) return { password: r.password, email };
  redirect(`/admin/users/${r.userId}?notice=${r.mailFailed ? "mailFailed" : "invited"}`);
}

export async function updateUserAction(userId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const { actor } = await requireManager();
  const r = await updateUser(actor, userId, { ...readUserFields(fd), isActive: fd.get("isActive") === "on" }, await requestContext());
  if (!r.ok) return { error: r.error };
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
  return { saved: true };
}

export async function generatePasswordAction(userId: string): Promise<FormState> {
  const { actor } = await requireManager();
  const r = await generatePasswordFor(actor, userId, await requestContext());
  if (!r.ok) return { error: r.error };
  return { password: r.password };
}

// One-click actions: do it, then come back to the user page with a message.
async function back(userId: string, r: { ok: true } | { ok: false; error: ManageError }, notice: string): Promise<never> {
  revalidatePath(`/admin/users/${userId}`);
  redirect(`/admin/users/${userId}?${r.ok ? `notice=${notice}` : `error=${r.error}`}`);
}

export async function resendInviteAction(userId: string) {
  const { actor } = await requireManager();
  const r = await resendInvitation(actor, userId, await requestContext());
  await back(userId, r, r.ok && r.mailFailed ? "mailFailed" : "resent");
}

export async function resetTwoFactorAction(userId: string) {
  const { actor } = await requireManager();
  await back(userId, await resetTwoFactorFor(actor, userId, await requestContext()), "reset2faDone");
}

export async function unlockAction(userId: string) {
  const { actor } = await requireManager();
  await back(userId, await unlockUser(actor, userId, await requestContext()), "unlocked");
}

export async function deleteUserAction(userId: string) {
  const { actor } = await requireManager();
  const r = await deleteUser(actor, userId, await requestContext());
  if (!r.ok) redirect(`/admin/users/${userId}?error=${r.error}`);
  revalidatePath("/admin/users");
  redirect("/admin/users");
}

export async function endSessionAction(sessionId: string, returnTo: string) {
  const { actor } = await requireManager();
  await endSession(actor, sessionId, await requestContext());
  revalidatePath(returnTo);
  redirect(returnTo);
}

export async function endAllSessionsAction(userId: string) {
  const { actor } = await requireManager();
  await back(userId, await endAllSessions(actor, userId, await requestContext()), "endedAll");
}

export async function removeTrustAction(deviceId: string, userId: string) {
  const { actor } = await requireManager();
  await back(userId, await removeTrustedDevice(actor, deviceId, await requestContext()), "trustRemoved");
}
