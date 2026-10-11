import { describe, expect, it } from "vitest";
import { athensDateTime, athensDateTimeFields, athensIsoDate, endOfAthensDay } from "./time";

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

describe("athensDateTime", () => {
  it("reads Athens day/month/year and hour:minute, summer and winter", () => {
    expect(athensDateTime("15/07/2026", "09:30")?.toISOString()).toBe("2026-07-15T06:30:00.000Z");
    expect(athensDateTime("5/1/2026", "9:05")?.toISOString()).toBe("2026-01-05T07:05:00.000Z");
    expect(athensDateTime("31/02/2026", "09:00")).toBeNull();
    expect(athensDateTime("15/07/2026", "25:00")).toBeNull();
    expect(athensDateTimeFields(new Date("2026-07-15T06:30:00Z"))).toEqual({ date: "15/07/2026", time: "09:30" });
  });
});

