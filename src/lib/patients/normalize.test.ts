import { describe, expect, it } from "vitest";
import { ageOn, parseDayMonthYear, phoneDigits, searchKey, sortKey } from "./normalize";

describe("searchKey", () => {
  it("ignores accents and capitals", () => {
    expect(searchKey("Παπαδοπούλου")).toBe(searchKey("ΠΑΠΑΔΟΠΟΥΛΟΥ"));
    expect(searchKey("παπαδοπουλου")).toBe(searchKey("Παπαδοπούλου"));
  });

  it.each([
    ["Παπαδοπούλου", "Papadopoulou"],
    ["Παπαδοπούλου", "papadopulu"],
    ["Χρήστος", "Christos"],
    ["Χρήστος", "Hristos"],
    ["Μιχάλης", "Mihalis"],
    ["Θεοδώρου", "Theodorou"],
    ["Θεοδώρου", "8eodorou"],
    ["Ευαγγελία", "Evangelia"],
    ["Ευαγγελία", "Evaggelia"],
    ["Αικατερίνη", "Ekaterini"],
    ["Μπάμπης", "Bampis"],
    ["Αντώνης", "Antonis"],
    ["Ξανθή", "Ksanthi"],
    ["Παππάς", "Papas"],
    ["Ψαρρού", "Psarrou"],
    ["Κώστας", "Costas"],
  ])("%s = %s", (greek, latin) => {
    expect(searchKey(latin)).toBe(searchKey(greek));
  });

  it("keeps words apart and drops punctuation", () => {
    expect(searchKey("  Νικολάου-Γεωργίου,  Μαρία ")).toBe("nikolau georgiu maria");
  });
});

describe("sortKey", () => {
  it("puts accented capitals with their letter", () => {
    const names = ["Ωραίος", "Άννα", "Βασίλης", "Αλέξης"].map(sortKey).sort();
    expect(names).toEqual(["ΑΛΕΞΗΣ", "ΑΝΝΑ", "ΒΑΣΙΛΗΣ", "ΩΡΑΙΟΣ"]);
  });
});

describe("phoneDigits", () => {
  it.each(["+30 694 123 4567", "0030 6941234567", "694-123-4567", "306941234567"])("%s", (p) => {
    expect(phoneDigits(p)).toBe("6941234567");
  });
  it("leaves foreign numbers with their country code", () => {
    expect(phoneDigits("+44 20 7946 0958")).toBe("442079460958");
  });
});

describe("ageOn", () => {
  const bd = new Date(Date.UTC(1980, 5, 15)); // 15 June 1980
  it("counts whole years and months", () => {
    expect(ageOn(bd, { year: 2026, month: 10, day: 11 })).toEqual({ years: 46, months: 3 });
  });
  it("turns a year older on the birthday, not the day before", () => {
    expect(ageOn(bd, { year: 2026, month: 6, day: 14 })).toEqual({ years: 45, months: 11 });
    expect(ageOn(bd, { year: 2026, month: 6, day: 15 })).toEqual({ years: 46, months: 0 });
  });
  it("returns null for a birth date in the future", () => {
    expect(ageOn(bd, { year: 1980, month: 1, day: 1 })).toBeNull();
  });
});

describe("parseDayMonthYear", () => {
  it("reads day/month/year, with or without leading zeros", () => {
    expect(parseDayMonthYear("15/06/1980")).toEqual(new Date(Date.UTC(1980, 5, 15)));
    expect(parseDayMonthYear("1/2/1986")).toEqual(new Date(Date.UTC(1986, 1, 1)));
  });
  it("rejects impossible or badly written dates, and leaves empty as empty", () => {
    expect(parseDayMonthYear("31/02/1990")).toBe("invalid");
    expect(parseDayMonthYear("1986-02-01")).toBe("invalid");
    expect(parseDayMonthYear("  ")).toBeNull();
  });
});

describe("splitPhone / joinPhone", () => {
  it("splits the country code from the number", async () => {
    const { splitPhone, joinPhone } = await import("./phone");
    expect(splitPhone("+357 99 123456")).toEqual({ code: "+357", local: "99 123456" });
    expect(splitPhone("+30 694 111 2233")).toEqual({ code: "+30", local: "694 111 2233" });
    expect(splitPhone("0044 20 7946 0958")).toEqual({ code: "+44", local: "20 7946 0958" });
    expect(splitPhone("6941112233")).toEqual({ code: "+30", local: "6941112233" });
    expect(joinPhone("+30", " 694 111 2233 ")).toBe("+30 694 111 2233");
    expect(joinPhone("+30", "  ")).toBe("");
  });
});
