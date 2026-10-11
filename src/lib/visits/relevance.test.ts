import { describe, expect, it } from "vitest";
import { relevantProcedures } from "./relevance";

describe("procedures offered after the examination", () => {
  it("nose → rhinoplasty only; breast → breast list by gender", () => {
    expect(relevantProcedures([{ area: "nose", text: "" }], "FEMALE")).toEqual({ face: ["rhinoplasty"] });
    expect(relevantProcedures([{ area: "breast", text: "" }], "TRANS_WOMAN")).toEqual({ breast: ["augmentation"] });
    expect(relevantProcedures([{ area: "breast", text: "" }], "TRANS_MAN")).toEqual({ breast: ["topSurgery"] });
  });

  it("ticked findings narrow the list; no findings → the area's usual list", () => {
    const face = relevantProcedures([{ area: "face", text: "", exam: { findings: { upperLids: {}, neck: {} } } }], "FEMALE").face;
    expect(face).toEqual(["blephUpper", "facelift", "submentalLipo"]);
    expect(relevantProcedures([{ area: "face", text: "" }], null).face).not.toContain("rhinoplasty");
    expect(relevantProcedures([{ area: "body", text: "", exam: { findings: { lipoedema: {}, mons: {} } } }], null)).toEqual({ body: ["lipoedema"], genital: ["monsLipo"] });
  });

  it("face and nose together; a trans woman also gets FFS", () => {
    const r = relevantProcedures([{ area: "nose", text: "" }, { area: "face", text: "", exam: { findings: { chin: {} } } }], "TRANS_WOMAN");
    expect(r.face).toEqual(["rhinoplasty", "facialImplants", "faceFat", "ffs", "trachealShave"]);
  });
});
