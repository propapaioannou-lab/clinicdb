import { createTranslator } from "next-intl";
import { db } from "@/lib/db";
import { audit, type RequestContext } from "@/lib/audit";
import { appUrl, escapeHtml, sendMail } from "@/lib/mail";
import { hashPassword, MIN_PASSWORD_LENGTH } from "@/lib/password";
import { createSession, hashToken, newToken } from "@/lib/auth/sessions";
import el from "../../../messages/el.json";

export const INVITE_HOURS = 72;

// New link for the user; any earlier unused link stops working.
export async function createInvitation(userId: string, createdById: string, now = new Date()) {
  const token = newToken();
  await db.$transaction([
    db.invitation.updateMany({ where: { userId, usedAt: null, revokedAt: null }, data: { revokedAt: now } }),
    db.invitation.create({
      data: {
        userId,
        createdById,
        tokenHash: hashToken(token),
        createdAt: now,
        expiresAt: new Date(now.getTime() + INVITE_HOURS * 60 * 60 * 1000),
      },
    }),
  ]);
  return token;
}

export async function sendInvitationEmail(to: { name: string; email: string }, token: string, inviterName: string) {
  const t = createTranslator({ locale: "el", messages: el, namespace: "emails.invitation" });
  const link = appUrl(`/invite/${token}`);
  const lines = [
    t("greeting", { name: to.name }),
    t("body", { inviter: inviterName }),
    link,
    t("expires", { hours: INVITE_HOURS }),
    t("network"),
    t("ignore"),
  ];
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#171717">
<p>${escapeHtml(lines[0])}</p><p>${escapeHtml(lines[1])}</p>
<p><a href="${escapeHtml(link)}" style="display:inline-block;background:#171717;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">${escapeHtml(t("button"))}</a></p>
<p style="color:#555">${escapeHtml(lines[3])}<br>${escapeHtml(lines[4])}<br>${escapeHtml(lines[5])}</p></div>`;
  await sendMail(to.email, t("subject"), lines.join("\n\n"), html);
}

export async function findValidInvitation(token: string | undefined, now = new Date()) {
  if (!token) return null;
  const inv = await db.invitation.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, email: true, name: true, isActive: true, passwordHash: true } } },
  });
  if (!inv || inv.usedAt || inv.revokedAt || inv.expiresAt <= now || !inv.user.isActive) return null;
  return inv;
}

export type AcceptResult = { ok: true; token: string; expiresAt: Date } | { ok: false; reason: "invalid_link" | "too_short" };

// Sets the password and starts a login that goes straight to 2FA setup.
export async function acceptInvitation(token: string, password: string, ctx: RequestContext, now = new Date()): Promise<AcceptResult> {
  const inv = await findValidInvitation(token, now);
  if (!inv) return { ok: false, reason: "invalid_link" };
  if (password.length < MIN_PASSWORD_LENGTH) return { ok: false, reason: "too_short" };

  // Atomic: the link can be used only once, even if submitted twice.
  const { count } = await db.invitation.updateMany({ where: { id: inv.id, usedAt: null }, data: { usedAt: now } });
  if (count === 0) return { ok: false, reason: "invalid_link" };
  await db.user.update({ where: { id: inv.userId }, data: { passwordHash: await hashPassword(password) } });

  const actor = { id: inv.user.id, email: inv.user.email };
  await audit({ action: "user.invitation.accepted", actor, entityType: "User", entityId: inv.userId }, ctx);
  const session = await createSession(inv.userId, ctx, now, { stage: "PENDING_ENROLL" });
  return { ok: true, token: session.token, expiresAt: session.session.expiresAt };
}
