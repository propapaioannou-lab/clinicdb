// The calendar's right-hand column sorts itself (calendar v3, 14 Oct 2026): patients
// waiting for a time (bubbles) always on top, then the cards by priority. A card has a
// base priority and boosts that apply for a while — "something new" for 15′, "their time
// has come" from 10′ before an appointment until it ends. All the numbers are here, so
// the order can be tuned as the clinic uses it. No database here (the screen re-sorts
// every half minute in the browser).

export type Boost = { from?: string; until?: string; add: number }; // ISO times
export type Rank = { base: number; boosts?: Boost[] };

export const PRIORITY = {
  // Cards, highest first when nothing special is going on.
  base: { next: 60, now: 50, confirm: 45, today: 40, waitlist: 35, tomorrow: 30, requests: 10, forms: 10 } as Record<string, number>,
  due: 200, // a patient's time has come (10′ before → end)
  waiting: 250, // a patient has arrived and is waiting
  busy: 100, // someone is with the doctor now
  fresh: 300, // something new (an entry, a booking request) for 15′
  toCall: 20, // confirmations still to be called
} as const;

export const DUE_BEFORE_MIN = 10;
export const FRESH_FOR_MIN = 15;

const plus = (iso: string, min: number) => new Date(new Date(iso).getTime() + min * 60e3).toISOString();

// From 10′ before the appointment until it ends.
export function dueBoost(startsAt: string, endsAt: string): Boost {
  return { from: plus(startsAt, -DUE_BEFORE_MIN), until: endsAt, add: PRIORITY.due };
}

// For 15′ after something new came in.
export function freshBoost(at: string): Boost {
  return { from: at, until: plus(at, FRESH_FOR_MIN), add: PRIORITY.fresh };
}

export function rankAt(r: Rank | undefined, now: Date): number {
  if (!r) return 0;
  const t = now.getTime();
  return r.base + (r.boosts ?? []).reduce((sum, b) => {
    if (b.from && t < new Date(b.from).getTime()) return sum;
    if (b.until && t >= new Date(b.until).getTime()) return sum;
    return sum + b.add;
  }, 0);
}

// Highest first; equal ones keep the order they were given in.
export function byPriority<T extends { rank?: Rank }>(items: T[], now: Date): T[] {
  return items
    .map((x, i) => ({ x, i, r: rankAt(x.rank, now) }))
    .sort((a, b) => b.r - a.r || a.i - b.i)
    .map((y) => y.x);
}

// When does the order change next? (so the screen re-sorts right then)
export function nextChange(items: { rank?: Rank }[], now: Date): Date | null {
  const t = now.getTime();
  const times = items.flatMap((x) => (x.rank?.boosts ?? []).flatMap((b) => [b.from, b.until])).flatMap((s) => (s ? [new Date(s).getTime()] : [])).filter((x) => x > t);
  return times.length ? new Date(Math.min(...times)) : null;
}
