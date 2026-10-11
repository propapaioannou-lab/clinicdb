import { describe, expect, it } from "vitest";
import { cleanProcedureDetails, detailsPhrase } from "./procedure-details";
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
