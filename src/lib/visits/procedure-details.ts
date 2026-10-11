// Details of a chosen procedure in the preoperative assessment (decided 11 Oct 2026):
// whenever an implant is chosen its specs are recorded (manufacturer, line, projection,
// size, plane); lifts and reductions record pattern and pedicle. Same field engine as the
// examination, so the choices are also written up as one line of text.

import { cleanValues, findingPhrase, opt as o, type Field, type FindingValue, type MeasureValue } from "./exams/engine";
import { IMPLANT_CHARTS, type ChartRow } from "./implant-charts";

export type ProcedureDetails = { fields: Field[]; parts: string[] };

const sided = (key: string, el: string, unit: string, say: string, max: number, extra: Partial<Extract<Field, { type: "measure" }>> = {}): Field => ({ key, el, type: "measure", unit, say, sides: true, max, ...extra });

// Manufacturer → line → projection. Size charts (cc → diameter / projection) are looked up
// in IMPLANT_CHARTS when loaded from the manufacturers' official tables; until then the
// size, diameter and projection are typed.
const BREAST_IMPLANT: Field[] = [
  { key: "maker", el: "Κατασκευαστής", type: "one", options: [o("motiva", "Motiva"), o("mentor", "Mentor"), o("other", "Άλλος", "ενθέματα")] },
  { key: "motivaLine", el: "Τύπος", type: "one", showIf: { field: "maker", in: ["motiva"] }, options: [o("round", "Round"), o("ergonomix", "Ergonomix"), o("ergonomix2", "Ergonomix 2")] },
  { key: "motivaProfile", el: "Προβολή", type: "one", showIf: { field: "maker", in: ["motiva"] }, options: [o("mini", "Mini"), o("demi", "Demi"), o("full", "Full"), o("corse", "Corsé")] },
  { key: "mentorLine", el: "Τύπος", type: "one", showIf: { field: "maker", in: ["mentor"] }, options: [o("memoryGel", "MemoryGel"), o("xtra", "MemoryGel Xtra"), o("boost", "MemoryGel Boost"), o("cpg", "MemoryShape (CPG)")] },
  { key: "mentorProfile", el: "Προβολή", type: "one", showIf: { field: "maker", in: ["mentor"] }, options: [o("moderate", "Moderate"), o("moderatePlus", "Moderate Plus"), o("high", "High"), o("ultraHigh", "Ultra High")] },
  sided("cc", "Μέγεθος", "cc", "", 1500),
  sided("diameter", "Διάμετρος", "cm", "διάμετρος", 20),
  sided("projection", "Προβολή (cm)", "cm", "προβολή", 10),
  { key: "plane", el: "Ένθεμα · τεχνική", type: "one", options: [
    o("subglandular", "υποαδενικά"), o("subfascial", "υποπεριτονιακά"), o("dualPlane", "dual plane"),
    o("submuscular", "υπομυϊκά"), o("preserve", "PRESERVE"), o("mia", "MIA"),
  ] },
  { key: "incision", el: "Τομή", type: "one", prefix: "τομή ", options: [o("imf", "υπομαστική"), o("periareolar", "περιθηλαία"), o("axillary", "μασχαλιαία"), o("previous", "από προηγούμενη ουλή")] },
];
const IMPLANT_PARTS = ["{maker} {motivaLine} {motivaProfile} {mentorLine} {mentorProfile} {cc}", "{diameter}", "{projection}", "{plane}", "{incision}"];

const LIFT: Field[] = [
  { key: "pattern", el: "Ανόρθωση · τεχνική", type: "one", options: [
    o("crescent", "crescent"), o("periareolar", "περιθηλαία (Benelli / round block)"), o("vertical", "κάθετη (Lejour / Hall-Findlay)"),
    o("lShort", "L / J short scar"), o("wise", "ανεστραμμένο Τ (Wise / keyhole)"), o("noVertical", "χωρίς κάθετη ουλή"),
  ] },
  { key: "pedicle", el: "Μίσχος", type: "one", options: [
    o("superior", "άνω", "άνω μίσχος"), o("superomedial", "άνω-έσω", "άνω-έσω μίσχος"), o("medial", "έσω", "έσω μίσχος"),
    o("inferior", "κάτω", "κάτω μίσχος"), o("central", "κεντρικός", "κεντρικός μίσχος"), o("fng", "ελεύθερο μόσχευμα θηλής"),
  ] },
  { key: "extras", el: "Επιπλέον", type: "many", options: [o("autoAug", "αυτο-αύξηση (Ribeiro / Graf)"), o("mesh", "πλέγμα / εσωτερικό νάρθηκα"), o("fat", "λίπος")] },
];
const LIFT_PARTS = ["{pattern}", "{pedicle}", "{extras}"];

const FAT: Field[] = [sided("fatCc", "Λίπος", "cc", "λίπος", 1500)];

const CHEST: Field[] = [
  { key: "technique", el: "Τεχνική", type: "one", options: [
    o("lipo", "λιποαναρρόφηση"), o("lipoExcision", "λιποαναρρόφηση + αφαίρεση αδένα (pull-through)"), o("periareolar", "περιθηλαία / keyhole"),
    o("buttonhole", "double incision με μίσχο (buttonhole)"), o("doubleFng", "double incision + ελεύθερο μόσχευμα θηλών"), o("skin", "με αφαίρεση δέρματος"),
  ] },
];

const FACIAL_IMPLANT: Field[] = [
  { key: "maker", el: "Κατασκευαστής", type: "one", options: [o("implantech", "Implantech"), o("medpor", "Medpor (Stryker)"), o("other", "Άλλος", "ένθεμα")] },
  { key: "material", el: "Υλικό", type: "one", options: [o("silicone", "σιλικόνη"), o("pe", "πορώδες πολυαιθυλένιο")] },
  { key: "size", el: "Μέγεθος", type: "one", prefix: "μέγεθος ", options: ["XS", "S", "M", "L", "XL"].map((x) => o(x, x)) },
];

const BUTTOCK_IMPLANT: Field[] = [
  { key: "maker", el: "Κατασκευαστής", type: "one", options: [o("polytech", "Polytech"), o("sebbin", "Sebbin"), o("implantech", "Implantech"), o("other", "Άλλος", "ενθέματα")] },
  { key: "shape", el: "Σχήμα", type: "one", options: [o("round", "στρογγυλά"), o("anatomical", "ανατομικά"), o("oval", "οβάλ")] },
  sided("cc", "Μέγεθος", "cc", "", 1500),
  { key: "plane", el: "Πλάνο", type: "one", options: [o("intramuscular", "ενδομυϊκά"), o("subfascial", "υποπεριτονιακά"), o("submuscular", "υπομυϊκά")] },
];

// Reconstruction: expander (two stages), direct-to-implant or autologous (decided 11 Oct 2026).
const RECON_DEVICE: Field = { key: "device", el: "Τύπος", type: "one", options: [o("expander", "διατατήρας ιστών"), o("dti", "άμεσο ένθεμα (DTI)"), o("autologous", "αυτόλογη (κρημνός)")] };
const onlyFor = (device: string) => (f: Field): Field => ({ ...f, showIf: [{ field: "device", in: [device] }, ...(f.showIf ? [f.showIf].flat() : [])] });
const EXPANDER: Field[] = ([
  { key: "expanderLine", el: "Mentor", type: "one", prefix: "διατατήρας Mentor ", options: [o("cpx4", "CPX4"), o("cpx4Tabs", "CPX4 με suture tabs"), o("artoura", "Artoura")] },
  sided("expanderCc", "Όγκος", "cc", "", 1500),
  sided("expanderWidth", "Πλάτος", "cm", "πλάτος", 20),
  sided("fill", "Αρχική πλήρωση", "cc", "αρχική πλήρωση", 1500),
  { key: "expanderPlane", el: "Θέση", type: "one", options: [o("prepectoral", "προθωρακικά"), o("subpectoral", "υποθωρακικά")] },
] satisfies Field[]).map(onlyFor("expander"));
const FLAP: Field[] = ([{ key: "flap", el: "Κρημνός", type: "one", prefix: "κρημνός ", options: [o("diep", "DIEP"), o("ld", "πλατύς ραχιαίος (LD)"), o("tug", "TUG"), o("pap", "PAP"), o("siea", "SIEA")] }] satisfies Field[]).map(onlyFor("autologous"));

const BREAST_IMPLANT_DETAILS = { fields: BREAST_IMPLANT, parts: IMPLANT_PARTS };
export const PROCEDURE_DETAILS: Record<string, ProcedureDetails> = {
  augmentation: BREAST_IMPLANT_DETAILS,
  implantExchange: BREAST_IMPLANT_DETAILS,
  reconstruction: {
    fields: [RECON_DEVICE, ...EXPANDER, ...BREAST_IMPLANT.map(onlyFor("dti")), ...FLAP],
    parts: ["{device}", "{expanderLine} {expanderCc}", "{expanderWidth}", "{fill}", "{expanderPlane}", ...IMPLANT_PARTS, "{flap}"],
  },
  augMastopexy: { fields: [...BREAST_IMPLANT, ...LIFT], parts: [...IMPLANT_PARTS, ...LIFT_PARTS] },
  mastopexy: { fields: LIFT, parts: LIFT_PARTS },
  reduction: { fields: LIFT, parts: LIFT_PARTS },
  breastFat: { fields: FAT, parts: ["{fatCc}"] },
  gynaecomastia: { fields: CHEST, parts: ["{technique}"] },
  topSurgery: { fields: CHEST, parts: ["{technique}"] },
  facialImplants: { fields: FACIAL_IMPLANT, parts: ["{maker} {material} {size}"] },
  buttockImplants: { fields: BUTTOCK_IMPLANT, parts: ["{maker} {shape} {cc}", "{plane}"] },
};

export type { ChartRow } from "./implant-charts";
export function chartFor(v: FindingValue): ChartRow[] {
  const line = v.maker === "motiva" ? [v.motivaLine, v.motivaProfile] : v.maker === "mentor" ? [v.mentorLine, v.mentorProfile] : [];
  return line.every(Boolean) && line.length ? (IMPLANT_CHARTS[`${v.maker}:${line.join(":")}`] ?? []) : [];
}

// Size chosen → base width and projection from the chart, side by side (decided 11 Oct
// 2026). A size that is not in the chart leaves what was typed.
export function fillFromChart(v: FindingValue): FindingValue {
  const chart = chartFor(v);
  const cc = v.cc as MeasureValue | undefined;
  if (!chart.length || !cc) return v;
  const out = { ...v, diameter: { ...((v.diameter as MeasureValue) ?? {}) }, projection: { ...((v.projection as MeasureValue) ?? {}) } };
  for (const side of ["r", "l"] as const) {
    const row = chart.find((r) => r.cc === cc[side]);
    if (!row) continue;
    out.diameter[side] = row.diameter;
    out.projection[side] = row.projection;
  }
  return out;
}

export const cleanProcedureDetails = (key: string, raw: unknown): FindingValue | null => {
  const def = PROCEDURE_DETAILS[key];
  if (!def) return null;
  const v = cleanValues(def.fields, raw);
  return Object.keys(v).length ? v : null;
};

// "Motiva Round Full 325/300 cc (Δ/Α), dual plane, τομή υπομαστική".
export function detailsPhrase(key: string, v: FindingValue | undefined): string {
  const def = PROCEDURE_DETAILS[key];
  return def && v ? (findingPhrase(def, v) ?? "") : "";
}
