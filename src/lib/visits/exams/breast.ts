// Structured breast examination (decided 11 Oct 2026): findings with multiple-choice
// details, written up automatically as Greek sentences for the record, a memo or a
// private-insurance certificate. Revision cases add previous breast surgeries and implant
// findings. Difficulty 1–10 adjusts fee (+5%) and time (+10′) per rank above 1.

export type Opt = { key: string; el: string };
export type Field = { key: string; el: string; type: "one" | "many" | "bool"; options?: Opt[] };
export type Finding = { key: string; el: string; fields: Field[]; revisionOnly?: boolean };

const o = (key: string, el: string): Opt => ({ key, el });
const DEGREE = [o("mild", "ήπια"), o("moderate", "μέτρια"), o("severe", "σοβαρή")];
const SIDE = [o("both", "αμφοτερόπλευρα"), o("right", "δεξιά"), o("left", "αριστερά")];

export const BREAST_FINDINGS: Finding[] = [
  {
    key: "ptosis", el: "Πτώση",
    fields: [
      { key: "grade", el: "Βαθμός", type: "one", options: [o("pseudo", "ψευδοπτώση"), o("1", "ήπια (Regnault I)"), o("2", "μέτρια (Regnault II)"), o("3", "σοβαρή (Regnault III)")] },
      { key: "side", el: "Πλευρά", type: "one", options: SIDE },
    ],
  },
  {
    key: "volume", el: "Όγκος",
    fields: [
      { key: "kind", el: "Είδος", type: "one", options: [o("hypoplasia", "υποπλασία"), o("loss", "απώλεια όγκου"), o("hypertrophy", "υπερτροφία")] },
      { key: "degree", el: "Βαθμός", type: "one", options: DEGREE },
      { key: "cup", el: "Cup", type: "one", options: ["A", "B", "C", "D", "E", "F"].map((c) => o(c, c)) },
    ],
  },
  {
    key: "asymmetry", el: "Ασυμμετρία",
    fields: [
      { key: "bigger", el: "Μεγαλύτερος", type: "one", options: [o("right", "δεξιός"), o("left", "αριστερός")] },
      { key: "degree", el: "Βαθμός", type: "one", options: DEGREE },
      { key: "aspects", el: "Σε", type: "many", options: [o("volume", "όγκο"), o("nipple", "θέση θηλής"), o("fold", "υπομαστική πτυχή")] },
    ],
  },
  {
    key: "laxity", el: "Χαλαρότητα δέρματος",
    fields: [
      { key: "degree", el: "Βαθμός", type: "one", options: DEGREE },
      { key: "striae", el: "Ραγάδες", type: "bool" },
      { key: "thin", el: "Λεπτό δέρμα", type: "bool" },
    ],
  },
  {
    key: "thickness", el: "Πάχος ιστού",
    fields: [{ key: "pinch", el: "Pinch άνω πόλου", type: "one", options: [o("lt2", "<2 cm"), o("2to4", "2–4 cm"), o("gt4", ">4 cm")] }],
  },
  {
    key: "nac", el: "Θηλή-άλως",
    fields: [
      { key: "enlarged", el: "Διευρυμένη άλως", type: "bool" },
      { key: "inverted", el: "Εισολκή θηλής", type: "one", options: [o("1", "βαθμού I"), o("2", "βαθμού II"), o("3", "βαθμού III")] },
      { key: "belowFold", el: "Θηλή κάτω από την πτυχή", type: "bool" },
      { key: "side", el: "Πλευρά", type: "one", options: SIDE },
    ],
  },
  {
    key: "imf", el: "Υπομαστική πτυχή",
    fields: [
      { key: "high", el: "Ψηλή / σφιχτή", type: "bool" },
      { key: "lower", el: "Χαμηλότερα", type: "one", options: [o("right", "δεξιά"), o("left", "αριστερά")] },
    ],
  },
  {
    key: "tuberous", el: "Σωληνοειδής μαστός",
    fields: [
      { key: "type", el: "Τύπος", type: "one", options: [o("1", "τύπου I"), o("2", "τύπου II"), o("3", "τύπου III")] },
      { key: "herniation", el: "Πρόπτωση άλω", type: "bool" },
      { key: "side", el: "Πλευρά", type: "one", options: SIDE },
    ],
  },
  {
    key: "chestWall", el: "Θωρακικό τοίχωμα",
    fields: [{ key: "kind", el: "Ευρήματα", type: "many", options: [o("excavatum", "πρόσθιο κοίλο"), o("carinatum", "πρόσθιο κυρτό"), o("scoliosis", "σκολίωση"), o("ribFlare", "προβολή πλευρών")] }],
  },
  {
    key: "implants", el: "Ενθέματα", revisionOnly: true,
    fields: [
      { key: "baker", el: "Καψική σύσπαση", type: "one", options: [o("1", "Baker I"), o("2", "Baker II"), o("3", "Baker III"), o("4", "Baker IV")] },
      { key: "malposition", el: "Μετατόπιση", type: "many", options: [o("bottomingOut", "bottoming out"), o("lateral", "πλάγια"), o("high", "ψηλά"), o("symmastia", "συμμαστία")] },
      { key: "rippling", el: "Ρυτίδωση (rippling)", type: "bool" },
      { key: "rupture", el: "Υποψία ρήξης", type: "bool" },
      { key: "doubleBubble", el: "Double bubble", type: "bool" },
      { key: "animation", el: "Animation deformity", type: "bool" },
      { key: "side", el: "Πλευρά", type: "one", options: SIDE },
    ],
  },
];

// Previous breast operations for a revision case; the year is typed by hand.
export const BREAST_PREVIOUS: Opt[] = [
  o("augmentation", "αυξητική μαστού"), o("mastopexy", "ανόρθωση μαστού"), o("augMastopexy", "αυξητική-ανορθωτική"),
  o("reduction", "μειωτική μαστού"), o("implantExchange", "αλλαγή ενθεμάτων"), o("reconstruction", "αποκατάσταση μαστού"),
  o("fat", "μεταμόσχευση λίπους"), o("gynaecomastia", "επέμβαση γυναικομαστίας"),
];

export type FindingValue = Record<string, string | string[] | boolean>;
export type BreastExam = {
  findings: Record<string, FindingValue>;
  revision?: { previous: { key: string; year?: string }[] };
  difficulty?: number;
};

// Rebuilt from the browser: unknown findings, fields and options are dropped.
export function cleanBreastExam(raw: unknown): BreastExam | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const findings: Record<string, FindingValue> = {};
  const revisionOn = !!r.revision && typeof r.revision === "object";
  const rawFindings = (r.findings && typeof r.findings === "object" ? r.findings : {}) as Record<string, unknown>;
  for (const f of BREAST_FINDINGS) {
    if (!(f.key in rawFindings) || (f.revisionOnly && !revisionOn)) continue;
    const src = (rawFindings[f.key] && typeof rawFindings[f.key] === "object" ? rawFindings[f.key] : {}) as Record<string, unknown>;
    const val: FindingValue = {};
    for (const field of f.fields) {
      const v = src[field.key];
      const keys = new Set((field.options ?? []).map((x) => x.key));
      if (field.type === "bool" && v === true) val[field.key] = true;
      if (field.type === "one" && typeof v === "string" && keys.has(v)) val[field.key] = v;
      if (field.type === "many" && Array.isArray(v)) {
        const list = [...new Set(v.filter((x): x is string => typeof x === "string" && keys.has(x)))];
        if (list.length) val[field.key] = list;
      }
    }
    findings[f.key] = val;
  }
  const exam: BreastExam = { findings };
  if (revisionOn) {
    const prevKeys = new Set(BREAST_PREVIOUS.map((x) => x.key));
    const prev = Array.isArray((r.revision as Record<string, unknown>).previous) ? ((r.revision as Record<string, unknown>).previous as unknown[]) : [];
    exam.revision = {
      previous: prev
        .map((p) => (p && typeof p === "object" ? (p as Record<string, unknown>) : {}))
        .filter((p) => typeof p.key === "string" && prevKeys.has(p.key))
        .slice(0, 20)
        .map((p) => {
          const year = typeof p.year === "string" ? p.year.trim().slice(0, 20) : "";
          return year ? { key: p.key as string, year } : { key: p.key as string };
        }),
    };
  }
  const d = Number(r.difficulty);
  if (Number.isInteger(d) && d >= 1 && d <= 10) exam.difficulty = d;
  return exam;
}

// Rank 1 = standard case; each rank above adds 5% fee and 10 minutes (decided 11 Oct 2026).
export function difficultyModifiers(rank: number | undefined) {
  const steps = rank && rank > 1 ? Math.min(rank, 10) - 1 : 0;
  return { feePercent: steps * 5, extraMinutes: steps * 10 };
}

const label = (field: Field | undefined, key: unknown) => field?.options?.find((x) => x.key === key)?.el;
const fieldOf = (f: string, k: string) => BREAST_FINDINGS.find((x) => x.key === f)?.fields.find((x) => x.key === k);
const join = (parts: string[]) => (parts.length <= 1 ? parts.join("") : `${parts.slice(0, -1).join(", ")} και ${parts.at(-1)}`);
const side = (f: string, v: FindingValue) => (v.side && v.side !== "both" ? ` ${label(fieldOf(f, "side"), v.side)}` : v.side === "both" ? " αμφοτερόπλευρα" : "");

// One phrase per finding, in the order of the list.
function phrase(key: string, v: FindingValue): string | null {
  const l = (k: string) => label(fieldOf(key, k), v[k]);
  switch (key) {
    case "ptosis": {
      if (!v.grade) return "πτώση μαστών" + side(key, v);
      if (v.grade === "pseudo") return "ψευδοπτώση" + side(key, v);
      return `${l("grade")!.replace(/ \(/, " πτώση (")}` + side(key, v);
    }
    case "volume": {
      const kind = l("kind") ?? "διαταραχή όγκου";
      const deg = l("degree");
      const cup = v.cup ? ` (cup ${v.cup})` : "";
      return `${deg ? `${deg} ` : ""}${kind}${cup}`;
    }
    case "asymmetry": {
      const aspects = Array.isArray(v.aspects) ? v.aspects.map((a) => label(fieldOf(key, "aspects"), a)!) : [];
      const where = aspects.length ? ` σε ${join(aspects)}` : "";
      // Accusative in the sentence: "τον δεξιό μαστό".
      const bigger = v.bigger ? `, με μεγαλύτερο τον ${v.bigger === "right" ? "δεξιό" : "αριστερό"} μαστό` : "";
      return `${l("degree") ? `${l("degree")} ` : ""}ασυμμετρία${where}${bigger}`;
    }
    case "laxity": {
      const extra = [v.striae && "ραγάδες", v.thin && "λεπτό δέρμα"].filter(Boolean) as string[];
      return `${l("degree") ? `${l("degree")} ` : ""}χαλαρότητα δέρματος${extra.length ? ` (${extra.join(", ")})` : ""}`;
    }
    case "thickness":
      return v.pinch ? `πάχος ιστού άνω πόλου ${l("pinch")}` : null;
    case "nac": {
      const parts = [v.enlarged && "διευρυμένη θηλαία άλως", v.inverted && `εισολκή θηλής ${l("inverted")}`, v.belowFold && "θηλή κάτω από την υπομαστική πτυχή"].filter(Boolean) as string[];
      return parts.length ? join(parts) + side(key, v) : null;
    }
    case "imf": {
      const parts = [v.high && "ψηλή, σφιχτή υπομαστική πτυχή", v.lower && `ασύμμετρη υπομαστική πτυχή (χαμηλότερα ${l("lower")})`].filter(Boolean) as string[];
      return parts.length ? join(parts) : null;
    }
    case "tuberous":
      return `σωληνοειδής μαστός${v.type ? ` ${l("type")}` : ""}${v.herniation ? " με πρόπτωση της θηλαίας άλω" : ""}` + side(key, v);
    case "chestWall": {
      const kinds = Array.isArray(v.kind) ? v.kind.map((k) => label(fieldOf(key, "kind"), k)!) : [];
      return kinds.length ? `παραμόρφωση θωρακικού τοιχώματος (${kinds.join(", ")})` : null;
    }
    case "implants": {
      const mal = Array.isArray(v.malposition) ? v.malposition.map((k) => label(fieldOf(key, "malposition"), k)!) : [];
      const parts = [
        v.baker && `καψική σύσπαση ${l("baker")}`,
        mal.length && `μετατόπιση ενθέματος (${mal.join(", ")})`,
        v.rippling && "ρυτίδωση (rippling)",
        v.rupture && "υποψία ρήξης ενθέματος",
        v.doubleBubble && "double bubble",
        v.animation && "animation deformity",
      ].filter(Boolean) as string[];
      return parts.length ? join(parts) + side(key, v) : null;
    }
  }
  return null;
}

// "Ασθενής 43 ετών με μέτρια πτώση (Regnault II) αμφοτερόπλευρα και μέτρια απώλεια όγκου (cup B). …"
export function breastSummary(exam: BreastExam, ageYears: number | null): string {
  const main = BREAST_FINDINGS.filter((f) => !f.revisionOnly && exam.findings[f.key])
    .map((f) => phrase(f.key, exam.findings[f.key]))
    .filter((p): p is string => !!p);
  const sentences: string[] = [];
  const who = ageYears !== null ? `Ασθενής ${ageYears} ετών` : "Ασθενής";
  if (main.length) sentences.push(`${who} με ${join(main)}.`);
  const prev = exam.revision?.previous ?? [];
  if (exam.revision) {
    const list = prev.map((p) => `${BREAST_PREVIOUS.find((x) => x.key === p.key)!.el}${p.year ? ` (${p.year})` : ""}`);
    sentences.push(list.length ? `Αναθεώρηση· προηγούμενες επεμβάσεις μαστού: ${list.join(", ")}.` : "Αναθεώρηση μετά από προηγούμενη επέμβαση μαστού.");
  }
  const implants = exam.findings.implants && phrase("implants", exam.findings.implants);
  if (implants) sentences.push(`Ευρήματα ενθεμάτων: ${implants}.`);
  return sentences.join(" ");
}
