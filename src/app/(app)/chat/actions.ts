"use server";

import { requestContext, requireSession } from "@/lib/auth/current";
import { sendMessage } from "@/lib/chat/chat";
import { activeCompany } from "@/lib/company";
import { loadActor } from "@/lib/users/manage";

// Staff chat (6a-10): send a message to the company chosen in the Ιατρείο | Spa switch.
export async function sendChatAction(text: string) {
  const session = await requireSession();
  const actor = await loadActor(session.user.id);
  const company = await activeCompany(actor);
  if (!company) return { error: "forbidden" as const };
  const r = await sendMessage(actor, company.id, String(text), await requestContext());
  return r.ok ? { ok: true as const, message: r.message } : { error: r.error };
}
