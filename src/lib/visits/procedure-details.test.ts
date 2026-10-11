import { describe, expect, it } from "vitest";
import { chartFor, cleanProcedureDetails, detailsPhrase, fillFromChart } from "./procedure-details";
import { cleanVisitInput } from "./visits";

describe("procedure details", () => {
  it("augmentation-mastopexy: implant specs, plane, incision and lift technique in one line", () => {
    const d = cleanProcedureDetails("augMastopexy", {
      maker: "motiva", motivaLine: "round", motivaProfile: "full", cc: { r: 325, l: "300" }, plane: "dualPlane", incision: "imf",
      pattern: "wise", pedicle: "superomedial", mentorLine: "xtra",
    })!;
    expect(d.mentorLine).toBeUndefined(); // Mentor lines only after "Mentor"
    expect(detailsPhrase("augMastopexy", d)).toBe(
      "Motiva Round Full 325/300 cc (Δ/Α), dual plane, τομή υπομαστική, ανεστραμμένο Τ (Wise / keyhole), άνω-έσω μίσχος",
    );
  });

  it("drops a line that no longer matches the manufacturer, and procedures without details", () => {
    expect(cleanProcedureDetails("augmentation", { maker: "mentor", motivaLine: "round", mentorProfile: "high" })).toEqual({ maker: "mentor", mentorProfile: "high" });
    expect(cleanProcedureDetails("augmentation", { maker: "bogus" })).toBeNull();
    expect(cleanProcedureDetails("facelift", { maker: "motiva" })).toBeNull();
  });

  it("visits keep the details of each procedure", () => {
    const v = cleanVisitInput({ procedures: [{ key: "augmentation", subs: [], details: { maker: "motiva", plane: "preserve" } }, { key: "facelift", details: { x: 1 } }] });
    if (v === "invalid_value") throw new Error("invalid");
    expect(v.procedures).toEqual([{ key: "augmentation", subs: [], details: { maker: "motiva", plane: "preserve" } }, { key: "facelift", subs: [] }]);
  });
});

describe("breast reconstruction", () => {
  it("records a Mentor expander, and drops implant fields unless direct-to-implant", () => {
    const d = cleanProcedureDetails("reconstruction", {
      device: "expander", expanderLine: "cpx4", expanderCc: { r: 400 }, fill: { r: 150 }, expanderPlane: "prepectoral", maker: "motiva",
    })!;
    expect(d.maker).toBeUndefined();
    expect(detailsPhrase("reconstruction", d)).toBe("διατατήρας ιστών, διατατήρας Mentor CPX4 Δ 400 cc, αρχική πλήρωση Δ 150 cc, προθωρακικά");
    expect(cleanProcedureDetails("reconstruction", { device: "dti", maker: "mentor", mentorLine: "xtra" })).toEqual({ device: "dti", maker: "mentor", mentorLine: "xtra" });
  });
});

describe("implant size charts (Motiva)", () => {
  it("your example: Ergonomix Demi 230 cc → base 10,5 cm, projection 3,6 cm on both sides", () => {
    const v = fillFromChart({ maker: "motiva", motivaLine: "ergonomix", motivaProfile: "demi", cc: { r: 230, l: 230 } });
    expect(v.diameter).toEqual({ r: 10.5, l: 10.5 });
    expect(v.projection).toEqual({ r: 3.6, l: 3.6 });
  });
  it("each side on its own; a size not in the chart leaves what was typed", () => {
    const v = fillFromChart({ maker: "motiva", motivaLine: "round", motivaProfile: "full", cc: { r: 335, l: 999 }, diameter: { l: 12 } });
    expect(v.diameter).toEqual({ r: 11.25, l: 12 });
    expect(v.projection).toEqual({ r: 4.6 });
  });
  it("Ergonomix 2 has its own sizes; Ergonomix Corsé stops at 12.5 cm; spot checks", () => {
    expect(chartFor({ maker: "motiva", motivaLine: "ergonomix2", motivaProfile: "corse" }).find((r) => r.cc === 1060)).toEqual({ diameter: 15, projection: 7.8, cc: 1060 });
    expect(chartFor({ maker: "motiva", motivaLine: "ergonomix", motivaProfile: "corse" }).at(-1)).toEqual({ diameter: 12.5, projection: 6.3, cc: 590 });
    expect(chartFor({ maker: "motiva", motivaLine: "round", motivaProfile: "corse" }).at(-1)).toEqual({ diameter: 15, projection: 7.8, cc: 1050 });
    expect(chartFor({ maker: "motiva", motivaLine: "round", motivaProfile: "mini" })[0]).toEqual({ diameter: 8.5, projection: 2.2, cc: 105 });
    expect(chartFor({ maker: "motiva", motivaLine: "ergonomix2", motivaProfile: "mini" })).toEqual([]);
    expect(chartFor({ maker: "mentor", mentorLine: "memoryGel", mentorProfile: "high" })).toEqual([]);
    // Volumes grow with the base width in every chart.
    for (const k of ["round", "ergonomix", "ergonomix2"]) for (const prof of ["mini", "demi", "full", "corse"]) {
      const rows = chartFor({ maker: "motiva", motivaLine: k, motivaProfile: prof });
      rows.slice(1).forEach((r, i) => expect(r.cc, `${k} ${prof} ${r.diameter}`).toBeGreaterThan(rows[i].cc));
    }
  });
});
