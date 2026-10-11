// Fewer taps (decided 11 Oct 2026): once an area is examined, the preoperative assessment
// opens the matching surgical area and offers only the procedures that fit the findings
// (e.g. Μύτη → Ρινοπλαστική; Άνω βλέφαρα → Βλεφαροπλαστική άνω). Everything else stays one
// tap away ("+ Όλες"). Breast procedures also follow the patient's gender.

import { BREAST_PROCEDURES_BY_SEX } from "./exams/areas";
import type { VisitArea } from "./visits";
import { PROCEDURE_AREAS } from "./catalog";

type Rule = { procArea: string; all: string[]; byFinding: Record<string, string[]> };
const ALL = (area: string) => PROCEDURE_AREAS.find((a) => a.key === area)!.procedures.map((p) => p.key);

// Examination area → surgical area, its default list, and finding → procedures.
const RULES: Record<string, Rule[]> = {
  breast: [{ procArea: "breast", all: ALL("breast"), byFinding: {} }],
  nose: [{ procArea: "face", all: ["rhinoplasty"], byFinding: {} }],
  face: [
    {
      procArea: "face",
      all: ALL("face").filter((k) => k !== "rhinoplasty"),
      byFinding: {
        forehead: ["endoBrow", "foreheadLift"],
        brows: ["endoBrow", "temporalLift", "foreheadLift"],
        upperLids: ["blephUpper"],
        lowerLids: ["blephLower", "midfaceLift", "faceFat"],
        midface: ["midfaceLift", "faceFat", "facelift"],
        jowls: ["facelift"],
        neck: ["facelift", "submentalLipo"],
        ears: ["otoplasty"],
        chin: ["facialImplants", "faceFat"],
      },
    },
  ],
  body: [
    {
      procArea: "body",
      all: ALL("body"),
      byFinding: {
        abdomen: ["abdominoplasty", "miniAbdo", "lipoAbdo", "lipo"],
        weightLoss: ["bodyLift", "abdominoplasty", "armLift", "thighLift", "backLift"],
        lipoedema: ["lipoedema"],
        arms: ["armLift", "lipo"],
        thighs: ["thighLift", "lipo"],
        buttocks: ["buttockLift", "bbl", "buttockImplants"],
        back: ["backLift", "lipo"],
      },
    },
    { procArea: "genital", all: [], byFinding: { mons: ["monsLipo"] } },
  ],
  genital: [
    {
      procArea: "genital",
      all: ALL("genital"),
      byFinding: { labiaMinora: ["labiaplasty"], hood: ["labiaplasty"], labiaMajora: ["labiaplasty"], mtf: ["vaginoplastyMtf"] },
    },
  ],
  other: [{ procArea: "other", all: ALL("other"), byFinding: { scar: ["scarRevision"], lesion: ["skinLesion"] } }],
};

// Surgical area → procedure keys to offer, for every surgical area the examination points
// to. Findings ticked → their procedures; none ticked → the area's default list.
export function relevantProcedures(areas: VisitArea[], sex: string | null): Record<string, string[]> {
  const out: Record<string, Set<string>> = {};
  for (const a of areas) {
    for (const rule of RULES[a.area] ?? []) {
      const ticked = Object.keys(a.exam?.findings ?? {}).filter((f) => rule.byFinding[f]);
      const keys = ticked.length ? ticked.flatMap((f) => rule.byFinding[f]) : rule.all;
      if (!keys.length) continue;
      const set = (out[rule.procArea] ??= new Set());
      for (const k of keys) set.add(k);
    }
  }
  // Facial feminization belongs with a trans woman's face or nose evaluation.
  if (sex === "TRANS_WOMAN" && out.face) for (const k of ["ffs", "trachealShave"]) out.face.add(k);
  const breastFor = sex ? BREAST_PROCEDURES_BY_SEX[sex] : undefined;
  if (out.breast && breastFor) out.breast = new Set([...out.breast].filter((k) => breastFor.includes(k)));
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, [...v]]));
}
