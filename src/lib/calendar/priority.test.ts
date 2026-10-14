import { describe, expect, it } from "vitest";
import { byPriority, dueBoost, freshBoost, nextChange, PRIORITY, rankAt } from "./priority";

// Calendar v3: the right-hand column orders itself by priority.

const at = (hm: string) => new Date(`2026-10-14T${hm}:00Z`);
const iso = (hm: string) => at(hm).toISOString();

describe("priority", () => {
  it("a patient's card rises 10′ before their time and drops when it ends", () => {
    const r = { base: 10, boosts: [dueBoost(iso("17:00"), iso("17:30"))] };
    expect(rankAt(r, at("16:49"))).toBe(10);
    expect(rankAt(r, at("16:50"))).toBe(10 + PRIORITY.due);
    expect(rankAt(r, at("17:29"))).toBe(10 + PRIORITY.due);
    expect(rankAt(r, at("17:30"))).toBe(10);
  });

  it("something new stays on top for 15′", () => {
    const r = { base: 5, boosts: [freshBoost(iso("10:00"))] };
    expect(rankAt(r, at("10:14"))).toBe(5 + PRIORITY.fresh);
    expect(rankAt(r, at("10:15"))).toBe(5);
  });

  it("sorts highest first and keeps the given order on ties", () => {
    const items = [
      { key: "today", rank: { base: 40 } },
      { key: "next", rank: { base: 60, boosts: [dueBoost(iso("17:00"), iso("17:10"))] } },
      { key: "tomorrow", rank: { base: 40 } },
      { key: "waitlist", rank: { base: 35, boosts: [freshBoost(iso("16:58"))] } },
      { key: "plain" },
    ];
    expect(byPriority(items, at("12:00")).map((x) => x.key)).toEqual(["next", "today", "tomorrow", "waitlist", "plain"]);
    expect(byPriority(items, at("16:59")).map((x) => x.key)).toEqual(["waitlist", "next", "today", "tomorrow", "plain"]);
  });

  it("knows when the order changes next", () => {
    const items = [{ rank: { base: 1, boosts: [dueBoost(iso("17:00"), iso("17:10"))] } }, { rank: { base: 2 } }];
    expect(nextChange(items, at("12:00"))).toEqual(at("16:50"));
    expect(nextChange(items, at("16:55"))).toEqual(at("17:10"));
    expect(nextChange(items, at("17:10"))).toBeNull();
  });
});
