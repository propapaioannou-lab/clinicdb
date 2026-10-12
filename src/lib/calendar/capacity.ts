import type { Span } from "./hours";

// How full a surgery day is (SPEC §4c surgery capacity; DESIGN 6a–6g week/month bars).
// Used time = the cases + 30′ turnover between them. Rules: max 3 operations; a case
// ≥ 4 h leaves only ≤ 2 h slots; a case ≥ 5 h closes the day; ending after the window
// is an over-run. A new case needs at least 1 h (+ 30′ turnover) to be worth offering.
export const TURNOVER = 30;

export type SurgeryLoad = {
  ops: number;
  used: number; // minutes, turnover included
  window: number; // minutes of the surgery window
  remaining: number; // what could still be booked (after one more turnover)
  state: "free" | "left" | "short" | "full" | "closes" | "over";
};

export function surgeryLoad(cases: Span[], window: Span[]): SurgeryLoad | null {
  const total = window.reduce((n, w) => n + w.to - w.from, 0);
  if (!total && !cases.length) return null;
  const ops = cases.length;
  const longest = Math.max(0, ...cases.map((c) => c.to - c.from));
  const used = cases.reduce((n, c) => n + c.to - c.from, 0) + TURNOVER * Math.max(0, ops - 1);
  const end = window.length ? Math.max(...window.map((w) => w.to)) : 0;
  let remaining = Math.max(0, total - used - (ops ? TURNOVER : 0));
  let state: SurgeryLoad["state"];
  if (cases.some((c) => c.to > end || !total)) state = "over";
  else if (longest >= 300) state = "closes";
  else if (ops >= 3 || remaining < 60) state = "full";
  else if (longest >= 240) {
    state = "short";
    remaining = Math.min(remaining, 120);
  } else state = ops ? "left" : "free";
  if (state === "closes" || state === "full" || state === "over") remaining = 0;
  return { ops, used, window: total, remaining, state };
}
