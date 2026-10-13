import { db } from "@/lib/db";
import { audit, type RequestContext } from "@/lib/audit";
import { canEditPatients } from "@/lib/permissions";
import type { Actor } from "@/lib/users/manage";

// Internal staff chat (SPEC §4, 6a-10): live messages between surgeon, assistant and front
// desk, one conversation per company, with one-tap presets (Settings → Λίστες). Runs on
// our own server only; messages are kept (never deleted). Guests have no access.

export const MAX_LENGTH = 500;
export type ChatLine = { id: string; senderId: string; senderName: string; senderRole: string; text: string; at: string };

const allowed = (actor: Actor, companyId: string) => canEditPatients(actor.level) && actor.companyIds.includes(companyId);
const line = (m: { id: string; senderId: string; senderName: string; senderRole: string; text: string; createdAt: Date }): ChatLine => ({
  id: m.id, senderId: m.senderId, senderName: m.senderName, senderRole: m.senderRole, text: m.text, at: m.createdAt.toISOString(),
});

// The latest messages, oldest first (for the chat box).
export async function recentMessages(actor: Actor, companyId: string, take = 40): Promise<ChatLine[] | null> {
  if (!allowed(actor, companyId)) return null;
  const rows = await db.chatMessage.findMany({ where: { companyId }, orderBy: { createdAt: "desc" }, take });
  return rows.reverse().map(line);
}

// The surgeon gets the doctor's presets; everyone else the staff's.
export async function presetsFor(actor: Actor, companyId: string): Promise<string[]> {
  if (!allowed(actor, companyId)) return [];
  const kind = actor.role === "SURGEON" ? "CHAT_PRESET_DOCTOR" : "CHAT_PRESET_STAFF";
  return (await db.listItem.findMany({ where: { companyId, kind, isActive: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { label: true } })).map((x) => x.label);
}

// Saved, then told to every open screen of the company (PostgreSQL NOTIFY → /api/live).
export async function sendMessage(actor: Actor, companyId: string, raw: string, ctx: RequestContext) {
  if (!allowed(actor, companyId)) return { ok: false as const, error: "forbidden" as const };
  const text = raw.replace(/\s+/g, " ").trim().slice(0, MAX_LENGTH);
  if (!text) return { ok: false as const, error: "empty" as const };
  const m = await db.$transaction(async (tx) => {
    const msg = await tx.chatMessage.create({ data: { companyId, senderId: actor.id, senderName: actor.name, senderRole: actor.role, text } });
    await tx.$executeRaw`SELECT pg_notify('clinic_live', ${JSON.stringify({ type: "chat", companyId, message: line(msg) })})`;
    return msg;
  });
  // The message itself is the record; the log notes that it was sent (not its text).
  await audit({ action: "chat.sent", actor, companyId, entityType: "ChatMessage", entityId: m.id }, ctx);
  return { ok: true as const, message: line(m) };
}
