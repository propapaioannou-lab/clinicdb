import { randomBytes } from "node:crypto";

// Small labelled options with stable keys: history quick picks and procedure
// sub-options. Edited in Settings; never deleted (old records keep their wording).
export type Pick = { key: string; labelEl: string; labelEn: string; hidden?: boolean };

const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
export const newKey = (prefix: string) => `${prefix}${randomBytes(4).toString("hex")}`;

// As sent by an editor: known keys keep their key, new ones get one, and any that were
// there before but are missing now are kept as hidden. null = not a list.
export function cleanPicks(raw: unknown, before: Pick[], prefix: string): Pick[] | null {
  if (!Array.isArray(raw)) return null;
  const known = new Map(before.map((c) => [c.key, c]));
  const out: Pick[] = [];
  for (const r of raw.slice(0, 60)) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const labelEl = text(o.labelEl, 120);
    if (!labelEl) continue;
    const key = typeof o.key === "string" && known.has(o.key) ? o.key : newKey(prefix);
    if (out.some((c) => c.key === key)) continue;
    out.push({ key, labelEl, labelEn: text(o.labelEn, 120) || labelEl, ...(o.hidden === true && { hidden: true }) });
  }
  for (const c of before) if (!out.some((x) => x.key === c.key)) out.push({ ...c, hidden: true });
  return out;
}
