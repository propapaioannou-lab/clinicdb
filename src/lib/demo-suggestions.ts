import { db } from "@/lib/db";
import { audit, type RequestContext } from "@/lib/audit";
import { isDemo } from "@/lib/demo";
import { canManageUsers } from "@/lib/permissions";
import type { Actor } from "@/lib/users/manage";

// «💬 Πρόταση» (online demo only): anyone logged in leaves a comment on the screen they are
// on; Owners/Admins read them, tick them done and export them to Markdown. Never deleted.

export const MAX_TEXT = 2000;
export type SuggestionRow = { id: string; userName: string; screen: string; path: string; text: string; at: string; doneAt: string | null };

export const canReadSuggestions = (actor: Actor) => isDemo() && canManageUsers(actor.level);

export async function addSuggestion(actor: Actor, companyId: string | null, input: { screen: string; path: string; text: string }, ctx: RequestContext) {
  if (!isDemo()) return { ok: false as const, error: "forbidden" as const };
  const text = String(input.text ?? "").trim().slice(0, MAX_TEXT);
  if (!text) return { ok: false as const, error: "empty" as const };
  const screen = String(input.screen ?? "").trim().slice(0, 100) || "—";
  const path = String(input.path ?? "").trim().slice(0, 300) || "/";
  const s = await db.suggestion.create({ data: { companyId, userId: actor.id, userName: actor.name, screen, path, text } });
  await audit({ action: "suggestion.created", actor, companyId, entityType: "Suggestion", entityId: s.id, details: { screen, path } }, ctx);
  return { ok: true as const };
}

export async function listSuggestions(actor: Actor, show: "open" | "done" | "all" = "open"): Promise<SuggestionRow[] | null> {
  if (!canReadSuggestions(actor)) return null;
  const rows = await db.suggestion.findMany({
    where: show === "open" ? { doneAt: null } : show === "done" ? { doneAt: { not: null } } : {},
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({ id: r.id, userName: r.userName, screen: r.screen, path: r.path, text: r.text, at: r.createdAt.toISOString(), doneAt: r.doneAt?.toISOString() ?? null }));
}

export async function openSuggestionCount(actor: Actor) {
  return canReadSuggestions(actor) ? db.suggestion.count({ where: { doneAt: null } }) : 0;
}

// Ticked done (or back to open); the tick is logged.
export async function setSuggestionDone(actor: Actor, id: string, done: boolean, ctx: RequestContext) {
  if (!canReadSuggestions(actor)) return { ok: false as const, error: "forbidden" as const };
  const r = await db.suggestion.updateMany({ where: { id }, data: done ? { doneAt: new Date(), doneById: actor.id } : { doneAt: null, doneById: null } });
  if (!r.count) return { ok: false as const, error: "not_found" as const };
  await audit({ action: done ? "suggestion.done" : "suggestion.reopened", actor, entityType: "Suggestion", entityId: id }, ctx);
  return { ok: true as const };
}

const athens = (d: Date) =>
  new Intl.DateTimeFormat("el-GR", { timeZone: "Europe/Athens", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);

// One Markdown file, grouped by screen, open ones as "- [ ]" and done ones as "- [x]".
export async function suggestionsMarkdown(actor: Actor, show: "open" | "done" | "all", ctx: RequestContext, now = new Date()): Promise<string | null> {
  if (!canReadSuggestions(actor)) return null;
  const rows = await db.suggestion.findMany({
    where: show === "open" ? { doneAt: null } : show === "done" ? { doneAt: { not: null } } : {},
    orderBy: [{ screen: "asc" }, { createdAt: "asc" }],
  });
  const lines = [`# Προτάσεις από τη δοκιμαστική έκδοση`, "", `Εξαγωγή: ${athens(now)} · ${rows.length} προτάσεις (${rows.filter((r) => !r.doneAt).length} ανοιχτές)`, ""];
  let screen: string | null = null;
  for (const r of rows) {
    if (r.screen !== screen) {
      screen = r.screen;
      lines.push(`## ${screen}`, "");
    }
    const body = r.text.replace(/\r?\n/g, "\n  ");
    lines.push(`- [${r.doneAt ? "x" : " "}] ${body}`, `  — ${r.userName}, ${athens(r.createdAt)} · \`${r.path}\``);
  }
  await audit({ action: "suggestion.exported", actor, details: { show, count: rows.length } }, ctx);
  return lines.join("\n") + "\n";
}
