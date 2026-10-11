import { describe, expect, it } from "vitest";
import { nextWeeklyExpiry } from "./weekly-expiry";

const at = (iso: string) => nextWeeklyExpiry(new Date(iso)).toISOString();

describe("nextWeeklyExpiry (Monday 05:00 Athens)", () => {
  it("in summer time (UTC+3) Monday 05:00 Athens is 02:00 UTC", () => {
    // Sunday 11 Oct 2026, 10:00 Athens
    expect(at("2026-10-11T07:00:00Z")).toBe("2026-10-12T02:00:00.000Z");
  });

  it("in winter time (UTC+2) Monday 05:00 Athens is 03:00 UTC", () => {
    // Wednesday 2 Dec 2026
    expect(at("2026-12-02T10:00:00Z")).toBe("2026-12-07T03:00:00.000Z");
  });

  it("Monday 04:59 Athens expires the same morning", () => {
    expect(at("2026-10-12T01:59:00Z")).toBe("2026-10-12T02:00:00.000Z");
  });

  it("Monday 05:00 Athens or later expires next Monday", () => {
    expect(at("2026-10-12T02:00:00Z")).toBe("2026-10-19T02:00:00.000Z");
    expect(at("2026-10-12T15:00:00Z")).toBe("2026-10-19T02:00:00.000Z");
  });

  it("crosses the winter-time change (last Sunday of October)", () => {
    // Saturday 24 Oct 2026 (UTC+3); clocks go back Sunday 25 Oct
    expect(at("2026-10-24T12:00:00Z")).toBe("2026-10-26T03:00:00.000Z");
  });

  it("crosses the summer-time change (last Sunday of March)", () => {
    // Friday 26 Mar 2027 (UTC+2); clocks go forward Sunday 28 Mar
    expect(at("2027-03-26T12:00:00Z")).toBe("2027-03-29T02:00:00.000Z");
  });

  it("crosses month and year ends", () => {
    // Thursday 31 Dec 2026
    expect(at("2026-12-31T12:00:00Z")).toBe("2027-01-04T03:00:00.000Z");
  });
});
