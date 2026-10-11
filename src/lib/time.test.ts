import { describe, expect, it } from "vitest";
import { athensIsoDate, endOfAthensDay } from "./time";

describe("Athens dates", () => {
  it("end of day in winter (UTC+2) and summer (UTC+3)", () => {
    expect(endOfAthensDay("2026-12-31")?.toISOString()).toBe("2026-12-31T21:59:59.999Z");
    expect(endOfAthensDay("2026-07-15")?.toISOString()).toBe("2026-07-15T20:59:59.999Z");
    expect(endOfAthensDay("31/12/2026")).toBeNull();
  });

  it("formats an instant as the Athens calendar date", () => {
    expect(athensIsoDate(new Date("2026-12-31T22:30:00Z"))).toBe("2027-01-01");
    expect(athensIsoDate(endOfAthensDay("2026-07-15")!)).toBe("2026-07-15");
  });
});
