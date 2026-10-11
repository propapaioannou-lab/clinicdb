import "server-only";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/current";
import { canManageUsers } from "@/lib/permissions";
import { loadActor } from "@/lib/users/manage";

// Owner/Admin only. Others get "not found" — they do not even learn the page exists.
export async function requireManager() {
  const session = await requireSession();
  const actor = await loadActor(session.user.id);
  if (!canManageUsers(actor.level)) notFound();
  return { session, actor };
}
