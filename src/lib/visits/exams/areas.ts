// The examination areas as data (decided 11 Oct 2026). Scales follow the most-used ones in
// the literature: Regnault, Baker, Simon (gynaecomastia), WPATH SOC-8 (top surgery),
// MRD1 / levator function, Hirmand (tear trough), Dedo (neck), Glogau, Fitzpatrick,
// Matarasso (abdomen), pannus grade, lipoedema stage 1–4 / type I–V, Pittsburgh (laxity
// after weight loss), Franco (labia minora), Vancouver (scars). Keys are stored on the
// visit, so wording can be changed here without breaking a record.

import { DEGREE, opt as o, SIDE, type AreaExam, type ExamValue, type Field, type Finding } from "./engine";

const side: Field = { key: "side", el: "Πλευρά", type: "one", options: SIDE };
const sideAfter = "{side}";
const deg = (key: string, el: string, words: [string, string, string]): Field => ({
  key, el, type: "one",
  options: [o("mild", "ήπια", words[0]), o("moderate", "μέτρια", words[1]), o("severe", "σοβαρή", words[2])],
});
const mm = (key: string, el: string, say: string, extra: Partial<Extract<Field, { type: "measure" }>> = {}): Field => ({ key, el, type: "measure", unit: "mm", say, sides: true, max: 50, ...extra });
const cm = (key: string, el: string, say: string, extra: Partial<Extract<Field, { type: "measure" }>> = {}): Field => ({ key, el, type: "measure", unit: "cm", say, sides: true, max: 60, ...extra });

// ── Μαστός / θώρακας ───────────────────────────────────────────────────────────────────
const G_GYNAE = "Γυναικομαστία";
const G_TOP = "Top surgery · δυσφορία φύλου";
const G_FEM = "Αυξητική θηλεοποίησης · δυσφορία φύλου";

const BREAST: AreaExam = {
  key: "breast",
  groups: [G_GYNAE, G_TOP, G_FEM],
  // Decided 11 Oct 2026: women → breast findings; men → gynaecomastia; trans men and
  // non-binary patients → top surgery; trans women → breast findings + feminizing
  // augmentation documentation.
  groupsBySex: { FEMALE: [""], MALE: [G_GYNAE], TRANS_MAN: [G_TOP], NON_BINARY: [G_TOP], TRANS_WOMAN: ["", G_FEM] },
  // The basic set (decided 11 Oct 2026), also shown on the breast sketch.
  measurements: {
    title: "Μετρήσεις (cm)",
    sketch: "breast",
    fields: [
      // English abbreviations on purpose (decided 11 Oct 2026: clearer than Greek).
      cm("jmd", "JMD (SN–N)", "JMD"),
      cm("nml", "N–ML", "N–ML"),
      cm("nimfStretch", "N–IMF (stretched)", "N–IMF"),
      cm("bw", "BW", "BW"),
      cm("areola", "Areola Ø", "areola Ø", { max: 20 }),
      { key: "intermammary", el: "IMD", type: "measure", unit: "cm", say: "IMD", max: 20 },
    ],
  },
  findings: [
    {
      key: "ptosis", el: "Πτώση",
      fields: [
        { key: "grade", el: "Βαθμός", type: "one", options: [o("pseudo", "ψευδοπτώση"), o("1", "ήπια (Regnault I)", "ήπια πτώση (Regnault I)"), o("2", "μέτρια (Regnault II)", "μέτρια πτώση (Regnault II)"), o("3", "σοβαρή (Regnault III)", "σοβαρή πτώση (Regnault III)")] },
        side,
      ],
      parts: ["{grade|πτώση μαστών}"], after: sideAfter,
    },
    {
      key: "volume", el: "Όγκος",
      fields: [
        { key: "degree", el: "Βαθμός", type: "one", options: DEGREE },
        { key: "kind", el: "Είδος", type: "one", options: [o("hypoplasia", "υποπλασία"), o("loss", "απώλεια όγκου"), o("hypertrophy", "υπερτροφία")] },
        { key: "cup", el: "Cup", type: "one", prefix: "(cup ", suffix: ")", options: ["A", "B", "C", "D", "E", "F", "G"].map((c) => o(c, c)) },
      ],
      parts: ["{degree} {kind|διαταραχή όγκου} {cup}"],
    },
    {
      key: "asymmetry", el: "Ασυμμετρία",
      fields: [
        { key: "degree", el: "Βαθμός", type: "one", options: DEGREE },
        { key: "aspects", el: "Σε", type: "many", prefix: "σε ", options: [o("volume", "όγκο"), o("nipple", "θέση θηλής"), o("fold", "υπομαστική πτυχή")] },
        // Accusative in the sentence: "με μεγαλύτερο τον δεξιό μαστό".
        { key: "bigger", el: "Μεγαλύτερος", type: "one", options: [o("right", "δεξιός", "με μεγαλύτερο τον δεξιό μαστό"), o("left", "αριστερός", "με μεγαλύτερο τον αριστερό μαστό")] },
      ],
      parts: ["{degree} ασυμμετρία {aspects}", "{bigger}"],
    },
    {
      key: "laxity", el: "Χαλαρότητα δέρματος",
      fields: [
        { key: "degree", el: "Βαθμός", type: "one", options: DEGREE },
        { key: "striae", el: "Ραγάδες", type: "bool", phrase: "ραγάδες" },
        { key: "thin", el: "Λεπτό δέρμα", type: "bool", phrase: "λεπτό δέρμα" },
      ],
      parts: ["{degree} χαλαρότητα δέρματος", "{striae}", "{thin}"],
    },
    {
      key: "nac", el: "Θηλή-άλως",
      fields: [
        { key: "enlarged", el: "Διευρυμένη άλως", type: "bool", phrase: "διευρυμένη θηλαία άλως" },
        { key: "inverted", el: "Εισολκή θηλής", type: "one", prefix: "εισολκή θηλής ", options: [o("1", "βαθμού I"), o("2", "βαθμού II"), o("3", "βαθμού III")] },
        { key: "belowFold", el: "Θηλή κάτω από την πτυχή", type: "bool", phrase: "θηλή κάτω από την υπομαστική πτυχή" },
        side,
      ],
      parts: ["{enlarged}", "{inverted}", "{belowFold}"], after: sideAfter, empty: "ευρήματα θηλής-άλω",
    },
    {
      key: "imf", el: "Υπομαστική πτυχή",
      fields: [
        { key: "high", el: "Ψηλή / σφιχτή", type: "bool", phrase: "ψηλή, σφιχτή υπομαστική πτυχή" },
        { key: "lower", el: "Χαμηλότερα", type: "one", prefix: "ασύμμετρη υπομαστική πτυχή (χαμηλότερα ", suffix: ")", options: [o("right", "δεξιά"), o("left", "αριστερά")] },
      ],
      parts: ["{high}", "{lower}"], empty: "ευρήματα υπομαστικής πτυχής",
    },
    {
      key: "tuberous", el: "Σωληνοειδής μαστός",
      fields: [
        { key: "type", el: "Τύπος", type: "one", options: [o("1", "τύπου I"), o("2", "τύπου II"), o("3", "τύπου III")] },
        { key: "herniation", el: "Πρόπτωση άλω", type: "bool", phrase: "με πρόπτωση της θηλαίας άλω" },
        side,
      ],
      parts: ["σωληνοειδή μαστό {type}", "{herniation}"], after: sideAfter,
    },
    {
      key: "chestWall", el: "Θωρακικό τοίχωμα",
      fields: [{ key: "kind", el: "Ευρήματα", type: "many", prefix: "παραμόρφωση θωρακικού τοιχώματος (", suffix: ")", options: [o("excavatum", "πρόσθιο κοίλο"), o("carinatum", "πρόσθιο κυρτό"), o("scoliosis", "σκολίωση"), o("ribFlare", "προβολή πλευρών")] }],
      parts: ["{kind}"], empty: "παραμόρφωση θωρακικού τοιχώματος",
    },
    {
      key: "implants", el: "Ενθέματα", revisionOnly: true, sentence: "Ευρήματα ενθεμάτων",
      fields: [
        { key: "baker", el: "Καψική σύσπαση", type: "one", prefix: "καψική σύσπαση ", options: [o("1", "Baker I"), o("2", "Baker II"), o("3", "Baker III"), o("4", "Baker IV")] },
        { key: "malposition", el: "Μετατόπιση", type: "many", prefix: "μετατόπιση ενθέματος (", suffix: ")", options: [o("bottomingOut", "bottoming out"), o("lateral", "πλάγια"), o("high", "ψηλά"), o("symmastia", "συμμαστία")] },
        { key: "rippling", el: "Ρυτίδωση (rippling)", type: "bool", phrase: "ρυτίδωση (rippling)" },
        { key: "rupture", el: "Υποψία ρήξης", type: "bool", phrase: "υποψία ρήξης ενθέματος" },
        { key: "doubleBubble", el: "Double bubble", type: "bool", phrase: "double bubble" },
        { key: "animation", el: "Animation deformity", type: "bool", phrase: "animation deformity" },
        side,
      ],
      parts: ["{baker}", "{malposition}", "{rippling}", "{rupture}", "{doubleBubble}", "{animation}"], after: sideAfter,
    },
    {
      key: "gynaecomastia", el: "Γυναικομαστία", group: G_GYNAE,
      fields: [
        { key: "simon", el: "Simon", type: "one", options: [
          o("1", "I · μικρή, χωρίς περίσσεια δέρματος", "Simon I"), o("2a", "IIa · μέτρια, χωρίς περίσσεια", "Simon IIa"),
          o("2b", "IIb · μέτρια, με περίσσεια δέρματος", "Simon IIb"), o("3", "III · μεγάλη, με περίσσεια δέρματος", "Simon III"),
        ] },
        { key: "kind", el: "Σύσταση", type: "one", options: [o("glandular", "αδενική", "αδενικού τύπου"), o("fatty", "λιπώδης", "λιπώδους τύπου (ψευδογυναικομαστία)"), o("mixed", "μικτή", "μικτού τύπου")] },
        { key: "tender", el: "Ευαισθησία", type: "bool", phrase: "με ευαισθησία" },
        { key: "cause", el: "Αίτιο", type: "many", prefix: "πιθανό αίτιο: ", options: [o("puberty", "εφηβική"), o("steroids", "αναβολικά"), o("drugs", "φάρμακα"), o("weight", "παχυσαρκία / απώλεια βάρους"), o("idiopathic", "ιδιοπαθής")] },
        side,
      ],
      parts: ["γυναικομαστία {simon}", "{kind}", "{tender}", "{cause}"], after: sideAfter,
    },
    {
      // Documented separately from the chest findings (WPATH SOC-8 asks for one assessment).
      key: "topSurgery", el: "Top surgery", group: G_TOP, sentence: "Εκτίμηση για top surgery",
      fields: [
        { key: "dysphoria", el: "Επίμονη δυσφορία θώρακα", type: "bool", phrase: "τεκμηριωμένη επίμονη δυσφορία φύλου σχετική με τον θώρακα" },
        { key: "goal", el: "Στόχος", type: "one", prefix: "στόχος: ", options: [o("flat", "επίπεδος θώρακας"), o("reduction", "μείωση όγκου"), o("contour", "ανδρικό περίγραμμα με θηλές")] },
        { key: "nipples", el: "Θηλές", type: "one", options: [o("graft", "ελεύθερο μόσχευμα", "θηλές με ελεύθερο μόσχευμα"), o("pedicle", "διατήρηση σε μίσχο", "διατήρηση θηλών σε μίσχο (αισθητικότητα)"), o("none", "χωρίς θηλές", "χωρίς αναδημιουργία θηλών")] },
        { key: "binder", el: "Binder", type: "one", options: [o("none", "όχι", "χωρίς χρήση binder"), o("lt8", "< 8 ώρες/ημέρα", "binder < 8 ώρες/ημέρα"), o("gt8", "≥ 8 ώρες/ημέρα", "binder ≥ 8 ώρες/ημέρα")] },
        { key: "binderIssues", el: "Επιπλοκές binder", type: "many", prefix: "επιπλοκές binder: ", options: [o("skin", "δερματικές βλάβες"), o("pain", "πόνος"), o("breathing", "δύσπνοια")] },
        { key: "hormones", el: "Ορμονοθεραπεία", type: "one", options: [o("on", "τεστοστερόνη", "σε τεστοστερόνη"), o("none", "όχι", "χωρίς ορμονοθεραπεία")] },
        { key: "months", el: "Μήνες ορμονοθεραπείας", type: "measure", unit: "μήνες", say: "επί", max: 600 },
        { key: "letter", el: "Επιστολή εκτίμησης", type: "one", options: [o("yes", "υπάρχει", "επιστολή εκτίμησης ψυχικής υγείας (WPATH SOC-8)"), o("pending", "εκκρεμεί", "εκκρεμεί επιστολή εκτίμησης ψυχικής υγείας")] },
        { key: "capacity", el: "Ικανότητα συναίνεσης", type: "bool", phrase: "ικανότητα συναίνεσης" },
        { key: "stable", el: "Σταθερή ψυχική/σωματική υγεία", type: "bool", phrase: "σταθερή ψυχική και σωματική υγεία" },
        { key: "technique", el: "Εκτίμηση τεχνικής", type: "one", prefix: "εκτίμηση: ", options: [o("periareolar", "keyhole / περιθηλαία"), o("double", "double incision"), o("other", "άλλη τεχνική")] },
      ],
      parts: ["{dysphoria}", "{goal}", "{nipples}", "{binder}", "{binderIssues}", "{hormones} {months}", "{letter}", "{capacity}", "{stable}", "{technique}"],
      empty: "υπό διερεύνηση",
    },
    {
      // Trans women: gender-affirming breast augmentation (decided 11 Oct 2026).
      key: "feminizing", el: "Αυξητική θηλεοποίησης", group: G_FEM, sentence: "Εκτίμηση για αυξητική θηλεοποίησης",
      fields: [
        { key: "dysphoria", el: "Επίμονη δυσφορία", type: "bool", phrase: "τεκμηριωμένη επίμονη δυσφορία φύλου" },
        { key: "hormones", el: "Ορμονοθεραπεία", type: "one", options: [o("estrogen", "οιστρογόνα", "σε οιστρογόνα"), o("none", "όχι", "χωρίς ορμονοθεραπεία")] },
        { key: "months", el: "Μήνες ορμονοθεραπείας", type: "measure", unit: "μήνες", say: "επί", max: 600 },
        { key: "growth", el: "Ανάπτυξη μαστών με ορμόνες", type: "one", options: [o("minimal", "ελάχιστη", "ελάχιστη ανάπτυξη μαστών με ορμονοθεραπεία"), o("moderate", "μέτρια", "μέτρια ανάπτυξη μαστών με ορμονοθεραπεία"), o("good", "καλή", "καλή ανάπτυξη μαστών με ορμονοθεραπεία")] },
        { key: "letter", el: "Επιστολή εκτίμησης", type: "one", options: [o("yes", "υπάρχει", "επιστολή εκτίμησης ψυχικής υγείας (WPATH SOC-8)"), o("pending", "εκκρεμεί", "εκκρεμεί επιστολή εκτίμησης ψυχικής υγείας")] },
        { key: "capacity", el: "Ικανότητα συναίνεσης", type: "bool", phrase: "ικανότητα συναίνεσης" },
        { key: "stable", el: "Σταθερή ψυχική/σωματική υγεία", type: "bool", phrase: "σταθερή ψυχική και σωματική υγεία" },
      ],
      parts: ["{dysphoria}", "{hormones} {months}", "{growth}", "{letter}", "{capacity}", "{stable}"],
      empty: "υπό διερεύνηση",
    },
  ],
  previous: [
    o("augmentation", "αυξητική μαστού"), o("mastopexy", "ανόρθωση μαστού"), o("augMastopexy", "αυξητική-ανορθωτική"),
    o("reduction", "μειωτική μαστού"), o("implantExchange", "αλλαγή ενθεμάτων"), o("reconstruction", "αποκατάσταση μαστού"),
    o("fat", "μεταμόσχευση λίπους"), o("gynaecomastia", "επέμβαση γυναικομαστίας"), o("topSurgery", "top surgery / μαστεκτομή"),
  ],
  previousSay: "προηγούμενες επεμβάσεις μαστού/θώρακα",
};

// Breast measurements the surgeon wants before any breast procedure (decided 11 Oct 2026);
// for gynaecomastia / top surgery the base width matters less than the areola.
const CHEST_ONLY = new Set(["gynaecomastia", "topSurgery", "gynaeLipo"]);
const BREAST_PROCEDURES = new Set(["augmentation", "mastopexy", "augMastopexy", "reduction", "reconstruction", "implantExchange", "invertedNipple", "tuberous", "deformity", "gynaecomastia", "topSurgery", "breastFat", "gynaeLipo"]);
export function requiredBreastMeasurements(procedureKeys: string[]): string[] {
  const breast = procedureKeys.filter((k) => BREAST_PROCEDURES.has(k));
  if (!breast.length) return [];
  return breast.every((k) => CHEST_ONLY.has(k)) ? ["jmd", "nimfStretch", "areola"] : ["jmd", "nimfStretch", "bw"];
}
// Breast procedures offered by gender (decided 11 Oct 2026); the rest stay one tap away.
// Unknown gender → all.
export const BREAST_PROCEDURES_BY_SEX: Record<string, string[]> = {
  FEMALE: ["augmentation", "mastopexy", "augMastopexy", "reduction", "reconstruction", "implantExchange", "invertedNipple", "tuberous", "deformity", "breastFat"],
  MALE: ["gynaecomastia", "implantExchange", "reconstruction"],
  TRANS_MAN: ["topSurgery"],
  NON_BINARY: ["topSurgery"],
  TRANS_WOMAN: ["augmentation"],
};

export function missingMeasurements(exam: ExamValue | undefined, required: string[]): string[] {
  return required.filter((k) => {
    const m = exam?.measurements?.[k];
    return !m || (m.r === undefined && m.l === undefined && m.v === undefined);
  });
}

// ── Πρόσωπο ─────────────────────────────────────────────────────────────────────────────
const FACE: AreaExam = {
  key: "face",
  // Standard eyelid measurements with the eye sketch (decided 11 Oct 2026).
  measurements: {
    title: "Βλέφαρα (mm)",
    sketch: "eyes",
    whenFindings: ["brows", "upperLids", "lowerLids"],
    note: "Normal: MRD1 3.5–4.5 · MRD2 5–5.5 · LF ≥ 12 (good), 5–11 (fair), ≤ 4 (poor) · MCD 8–10 ♀ / 6–8 ♂",
    fields: [
      mm("mrd1", "MRD1", "MRD1", { min: -5, max: 10 }),
      mm("mrd2", "MRD2", "MRD2", { max: 12 }),
      mm("lf", "LF (levator function)", "LF", { max: 25 }),
      mm("mcd", "MCD (lid crease)", "MCD", { max: 20 }),
      mm("tps", "TPS", "TPS", { max: 20 }),
    ],
  },
  findings: [
    {
      key: "forehead", el: "Μέτωπο / μεσόφρυο",
      fields: [
        deg("lines", "Ρυτίδες μετώπου", ["ήπιες ρυτίδες μετώπου", "μέτριες ρυτίδες μετώπου", "έντονες ρυτίδες μετώπου"]),
        { key: "glabella", el: "Ρυτίδες μεσόφρυου", type: "bool", phrase: "ρυτίδες μεσόφρυου" },
      ],
      parts: ["{lines}", "{glabella}"], empty: "ρυτίδες μετώπου",
    },
    {
      key: "brows", el: "Φρύδια",
      fields: [
        deg("ptosis", "Πτώση", ["ήπια πτώση φρυδιών", "μέτρια πτώση φρυδιών", "σοβαρή πτώση φρυδιών"]),
        { key: "lateral", el: "Πλάγια κάλυψη (hooding)", type: "bool", phrase: "πλάγια κάλυψη (lateral hooding)" },
        { key: "asym", el: "Ασυμμετρία", type: "bool", phrase: "ασυμμετρία φρυδιών" },
        side,
      ],
      parts: ["{ptosis}", "{lateral}", "{asym}"], after: sideAfter, empty: "πτώση φρυδιών",
    },
    {
      key: "upperLids", el: "Άνω βλέφαρα",
      fields: [
        deg("derm", "Δερματόχαλαση", ["ήπια δερματόχαλαση άνω βλεφάρων", "μέτρια δερματόχαλαση άνω βλεφάρων", "σοβαρή δερματόχαλαση άνω βλεφάρων"]),
        { key: "fat", el: "Προβολή λίπους", type: "many", prefix: "προβολή λίπους (", suffix: ")", options: [o("medial", "έσω"), o("central", "κεντρικό")] },
        { key: "gland", el: "Πρόπτωση δακρυϊκού", type: "bool", phrase: "πρόπτωση δακρυϊκού αδένα" },
        { key: "field", el: "Περιορισμός οπτικού πεδίου", type: "bool", phrase: "περιορισμός άνω οπτικού πεδίου" },
        { key: "ptosis", el: "Βλεφαρόπτωση", type: "one", options: [o("mild", "ήπια 1–2 mm", "ήπια βλεφαρόπτωση (1–2 mm)"), o("moderate", "μέτρια 3–4 mm", "μέτρια βλεφαρόπτωση (3–4 mm)"), o("severe", "σοβαρή > 4 mm", "σοβαρή βλεφαρόπτωση (> 4 mm)")] },
        side,
      ],
      parts: ["{derm}", "{fat}", "{gland}", "{field}", "{ptosis}"], after: sideAfter, empty: "δερματόχαλαση άνω βλεφάρων",
    },
    {
      key: "lowerLids", el: "Κάτω βλέφαρα",
      fields: [
        { key: "bags", el: "Λιπώδεις σάκοι", type: "many", prefix: "προβολή λιπωδών σάκων (", suffix: ")", options: [o("medial", "έσω"), o("central", "κεντρικός"), o("lateral", "έξω")] },
        deg("skin", "Περίσσεια δέρματος", ["ήπια περίσσεια δέρματος", "μέτρια περίσσεια δέρματος", "σοβαρή περίσσεια δέρματος"]),
        { key: "tearTrough", el: "Αύλακα δακρύων (Hirmand)", type: "one", prefix: "αύλακα δακρύων ", options: [o("1", "I · μόνο έσω"), o("2", "II · έως μέσο"), o("3", "III · ολόκληρος κόγχος")].map((x, i) => ({ ...x, phrase: `Hirmand ${["I", "II", "III"][i]}` })) },
        { key: "snap", el: "Snap test", type: "one", options: [o("normal", "φυσιολογικό", "φυσιολογικό snap test"), o("slow", "βραδεία επαναφορά", "βραδεία επαναφορά στο snap test"), o("none", "χωρίς επαναφορά", "απουσία επαναφοράς στο snap test")] },
        mm("distraction", "Distraction test (> 6 = χαλαρό)", "distraction", { max: 20 }),
        { key: "scleral", el: "Έκθεση σκληρού", type: "bool", phrase: "έκθεση σκληρού (scleral show)" },
        { key: "vector", el: "Αρνητικό διάνυσμα", type: "bool", phrase: "αρνητικό διάνυσμα (negative vector)" },
        { key: "festoons", el: "Festoons / malar bags", type: "bool", phrase: "festoons" },
        side,
      ],
      parts: ["{bags}", "{skin}", "{tearTrough}", "{snap}", "{distraction}", "{scleral}", "{vector}", "{festoons}"], after: sideAfter, empty: "γήρανση κάτω βλεφάρων",
    },
    {
      key: "midface", el: "Μέσο πρόσωπο",
      fields: [
        deg("deflation", "Απώλεια όγκου", ["ήπια απώλεια όγκου μέσου προσώπου", "μέτρια απώλεια όγκου μέσου προσώπου", "σοβαρή απώλεια όγκου μέσου προσώπου"]),
        { key: "malar", el: "Πτώση ζυγωματικού λίπους", type: "bool", phrase: "πτώση ζυγωματικού λίπους" },
        deg("nlf", "Ρινοπαρειακή αύλακα", ["ήπια ρινοπαρειακή αύλακα", "μέτρια ρινοπαρειακή αύλακα", "βαθιά ρινοπαρειακή αύλακα"]),
        { key: "marionette", el: "Γραμμές μαριονέτας", type: "bool", phrase: "γραμμές μαριονέτας" },
      ],
      parts: ["{deflation}", "{malar}", "{nlf}", "{marionette}"], empty: "γήρανση μέσου προσώπου",
    },
    {
      key: "jowls", el: "Jowls / γνάθος",
      fields: [
        deg("degree", "Βαθμός", ["ήπια jowls", "μέτρια jowls", "έντονα jowls"]),
        { key: "prejowl", el: "Prejowl sulcus", type: "bool", phrase: "prejowl sulcus" },
        { key: "jawline", el: "Απώλεια ορίου γνάθου", type: "bool", phrase: "απώλεια ορίου κάτω γνάθου" },
      ],
      parts: ["{degree}", "{prejowl}", "{jawline}"], empty: "jowls",
    },
    {
      key: "neck", el: "Τράχηλος",
      fields: [
        { key: "dedo", el: "Dedo", type: "one", prefix: "τράχηλο ", options: [
          o("1", "I · ελάχιστα ευρήματα", "Dedo I (ελάχιστα ευρήματα)"), o("2", "II · χαλαρό δέρμα", "Dedo II (χαλαρότητα δέρματος)"),
          o("3", "III · υπογένειο λίπος", "Dedo III (υπογένειο λίπος)"), o("4", "IV · πλατυσματικές ταινίες", "Dedo IV (πλατυσματικές ταινίες)"),
          o("5", "V · οπισθογναθία", "Dedo V (οπισθογναθία)"), o("6", "VI · χαμηλό υοειδές", "Dedo VI (χαμηλό υοειδές)"),
        ] },
        deg("laxity", "Χαλαρότητα δέρματος", ["ήπια χαλαρότητα δέρματος τραχήλου", "μέτρια χαλαρότητα δέρματος τραχήλου", "σοβαρή χαλαρότητα δέρματος τραχήλου"]),
        { key: "fat", el: "Υπογένειο λίπος", type: "one", options: [o("sub", "υποδόριο", "υποδόριο υπογένειο λίπος"), o("deep", "υποπλατυσματικό", "υποπλατυσματικό λίπος"), o("both", "και τα δύο", "υποδόριο και υποπλατυσματικό λίπος")] },
        { key: "bands", el: "Πλατυσματικές ταινίες", type: "one", options: [o("static", "στατικές", "στατικές πλατυσματικές ταινίες"), o("dynamic", "δυναμικές", "δυναμικές πλατυσματικές ταινίες")] },
        { key: "gland", el: "Πτώση υπογνάθιου αδένα", type: "one", options: [o("visible", "ορατή", "ορατή πτώση υπογνάθιων αδένων"), o("palpable", "ψηλαφητή", "ψηλαφητή πτώση υπογνάθιων αδένων")] },
        { key: "cma", el: "Αυχενογενειακή γωνία", type: "measure", unit: "°", say: "αυχενογενειακή γωνία", max: 180 },
      ],
      parts: ["{dedo}", "{laxity}", "{fat}", "{bands}", "{gland}", "{cma}"], empty: "γήρανση τραχήλου",
    },
    {
      key: "skin", el: "Δέρμα",
      fields: [
        { key: "glogau", el: "Glogau", type: "one", prefix: "φωτογήρανση ", options: [
          o("1", "I · χωρίς ρυτίδες", "Glogau I"), o("2", "II · ρυτίδες στην κίνηση", "Glogau II"),
          o("3", "III · ρυτίδες σε ηρεμία", "Glogau III"), o("4", "IV · μόνο ρυτίδες", "Glogau IV"),
        ] },
        { key: "fitz", el: "Fitzpatrick", type: "one", prefix: "φωτότυπο Fitzpatrick ", options: ["I", "II", "III", "IV", "V", "VI"].map((x) => o(x, x)) },
        { key: "quality", el: "Ποιότητα", type: "many", options: [o("thin", "λεπτό δέρμα"), o("thick", "παχύ σμηγματορροϊκό δέρμα"), o("elastosis", "ηλιακή ελάστωση"), o("pigment", "δυσχρωμίες"), o("smoker", "δέρμα καπνιστή")] },
      ],
      parts: ["{glogau}", "{fitz}", "{quality}"],
    },
    {
      key: "ears", el: "Αυτιά",
      fields: [
        { key: "antihelix", el: "Απουσία ανθέλικας", type: "bool", phrase: "απουσία πτυχής ανθέλικας" },
        { key: "concha", el: "Υπερτροφία κόγχης", type: "bool", phrase: "υπερτροφία κόγχης" },
        { key: "lobule", el: "Προβολή λοβίου", type: "bool", phrase: "προβολή λοβίου" },
        { key: "split", el: "Σχισμένο λοβίο", type: "bool", phrase: "σχισμένο λοβίο" },
        mm("distance", "Έλικα–μαστοειδής", "απόσταση έλικας–μαστοειδούς", { max: 50 }),
        side,
      ],
      parts: ["{antihelix}", "{concha}", "{lobule}", "{split}", "{distance}"], after: sideAfter, empty: "αφεστώτα ώτα",
    },
    {
      key: "chin", el: "Πηγούνι",
      fields: [deg("degree", "Υποπλασία", ["ήπια υποπλασία πηγουνιού", "μέτρια υποπλασία πηγουνιού", "σοβαρή υποπλασία πηγουνιού"])],
      parts: ["{degree}"], empty: "υποπλασία πηγουνιού",
    },
  ],
  previous: [
    o("facelift", "ανόρθωση προσώπου"), o("necklift", "ανόρθωση τραχήλου"), o("blephUpper", "βλεφαροπλαστική άνω"), o("blephLower", "βλεφαροπλαστική κάτω"),
    o("brow", "ανόρθωση φρυδιών"), o("fat", "μεταμόσχευση λίπους"), o("threads", "νήματα"), o("filler", "υαλουρονικό"), o("permanent", "μόνιμα fillers"),
    o("otoplasty", "ωτοπλαστική"), o("chin", "ένθεμα πηγουνιού"), o("ffs", "επέμβαση θηλεοποίησης προσώπου (FFS)"),
  ],
  previousSay: "προηγούμενες επεμβάσεις προσώπου",
};

// ── Μύτη ────────────────────────────────────────────────────────────────────────────────
const deg1 = (key: string, el: string, unit: string, say: string, max: number): Field => ({ key, el, type: "measure", unit, say, max });
const NOSE: AreaExam = {
  key: "nose",
  measurements: {
    title: "Μετρήσεις",
    note: "Normal: NFA 115–130° · NLA 90–95° (♂) / 100–105° (♀) · Goode 0.55–0.60",
    // English terms on purpose (decided 11 Oct 2026).
    fields: [
      deg1("nasofrontal", "NFA (nasofrontal angle)", "°", "NFA", 180),
      deg1("nasolabial", "NLA (nasolabial angle)", "°", "NLA", 180),
      { key: "goode", el: "Goode ratio", type: "measure", unit: "", say: "Goode ratio", max: 2 },
      deg1("projection", "Tip projection", "mm", "tip projection", 60),
      deg1("length", "Nasal length (N–T)", "mm", "nasal length", 80),
    ],
  },
  findings: [
    {
      key: "dorsum", el: "Ράχη",
      fields: [
        { key: "hump", el: "Κύρτωμα", type: "one", options: [o("small", "μικρό", "μικρό κύρτωμα ράχης"), o("moderate", "μέτριο", "μέτριο κύρτωμα ράχης"), o("large", "μεγάλο", "μεγάλο κύρτωμα ράχης")] },
        { key: "saddle", el: "Εφιππιοειδής", type: "bool", phrase: "εφιππιοειδή ράχη" },
        { key: "wide", el: "Ευρεία οστέινη πυραμίδα", type: "bool", phrase: "ευρεία οστέινη πυραμίδα" },
        { key: "radix", el: "Χαμηλή ρίζα", type: "bool", phrase: "χαμηλή ρίζα" },
      ],
      parts: ["{hump}", "{saddle}", "{wide}", "{radix}"], empty: "ευρήματα ράχης",
    },
    {
      key: "deviation", el: "Απόκλιση",
      fields: [
        { key: "shape", el: "Σχήμα", type: "one", options: [o("c", "C", "απόκλιση πυραμίδας σε σχήμα C"), o("reverseC", "ανάστροφο C", "απόκλιση πυραμίδας σε σχήμα ανάστροφου C"), o("s", "S", "απόκλιση πυραμίδας σε σχήμα S"), o("linear", "ευθύγραμμη", "ευθύγραμμη απόκλιση πυραμίδας")] },
        { key: "to", el: "Προς", type: "one", prefix: "προς τα ", options: [o("right", "δεξιά"), o("left", "αριστερά")] },
      ],
      parts: ["{shape|απόκλιση ρινικής πυραμίδας} {to}"],
    },
    {
      key: "tip", el: "Ρινικό άκρο",
      fields: [{ key: "features", el: "Ευρήματα", type: "many", options: [
        o("bulbous", "βολβώδες", "βολβώδες άκρο"), o("boxy", "boxy", "τετραγωνισμένο (boxy) άκρο"), o("ptotic", "πτωτικό", "πτωτικό άκρο"),
        o("under", "χαμηλή προβολή", "ανεπαρκή προβολή άκρου"), o("over", "υπερπροβολή", "υπερπροβολή άκρου"), o("asym", "ασύμμετρο", "ασυμμετρία άκρου"),
        o("bifid", "δισχιδές", "δισχιδές άκρο"), o("pinched", "pinched", "pinched άκρο"),
      ] }],
      parts: ["{features}"], empty: "ευρήματα ρινικού άκρου",
    },
    {
      key: "base", el: "Βάση / ρώθωνες",
      fields: [
        { key: "wide", el: "Ευρεία βάση", type: "bool", phrase: "ευρεία βάση πτερυγίων" },
        { key: "hanging", el: "Κρεμάμενη κολουμέλλα", type: "bool", phrase: "κρεμάμενη κολουμέλλα" },
        { key: "retracted", el: "Ανάσπαση πτερυγίων", type: "bool", phrase: "ανάσπαση πτερυγίων" },
        { key: "asym", el: "Ασυμμετρία ρωθώνων", type: "bool", phrase: "ασυμμετρία ρωθώνων" },
      ],
      parts: ["{wide}", "{hanging}", "{retracted}", "{asym}"], empty: "ευρήματα βάσης",
    },
    {
      key: "airway", el: "Λειτουργικά",
      fields: [
        { key: "obstruction", el: "Απόφραξη", type: "one", options: [o("both", "αμφοτερόπλευρα", "αμφοτερόπλευρη ρινική απόφραξη"), o("right", "δεξιά", "ρινική απόφραξη δεξιά"), o("left", "αριστερά", "ρινική απόφραξη αριστερά")] },
        { key: "septum", el: "Απόκλιση διαφράγματος", type: "one", options: [o("anterior", "πρόσθια", "πρόσθια απόκλιση διαφράγματος"), o("posterior", "οπίσθια", "οπίσθια απόκλιση διαφράγματος"), o("both", "πρόσθια & οπίσθια", "πρόσθια και οπίσθια απόκλιση διαφράγματος")] },
        { key: "septumTo", el: "Προς", type: "one", prefix: "προς τα ", options: [o("right", "δεξιά"), o("left", "αριστερά")] },
        { key: "internal", el: "Έσω βαλβίδα (Cottle +)", type: "bool", phrase: "ανεπάρκεια έσω βαλβίδας (Cottle θετικό)" },
        { key: "external", el: "Κατάρρευση έξω βαλβίδας", type: "bool", phrase: "κατάρρευση έξω βαλβίδας" },
        deg("turbinates", "Υπερτροφία κογχών", ["ήπια υπερτροφία κογχών", "μέτρια υπερτροφία κογχών", "σοβαρή υπερτροφία κογχών"]),
      ],
      parts: ["{obstruction}", "{septum} {septumTo}", "{internal}", "{external}", "{turbinates}"], empty: "λειτουργικά προβλήματα αναπνοής",
    },
    {
      key: "skin", el: "Δέρμα μύτης",
      fields: [
        { key: "thickness", el: "Πάχος", type: "one", options: [o("thin", "λεπτό", "λεπτό δέρμα μύτης"), o("medium", "μέσο", "μέσου πάχους δέρμα μύτης"), o("thick", "παχύ", "παχύ δέρμα μύτης")] },
        { key: "sebaceous", el: "Σμηγματορροϊκό", type: "bool", phrase: "σμηγματορροϊκό δέρμα" },
      ],
      parts: ["{thickness}", "{sebaceous}"],
    },
  ],
  previous: [o("rhinoplasty", "ρινοπλαστική"), o("septoplasty", "διαφραγματοπλαστική"), o("turbinates", "επέμβαση κογχών"), o("filler", "filler μύτης"), o("trauma", "κάταγμα ρινός")],
  previousSay: "προηγούμενες επεμβάσεις / κακώσεις μύτης",
};

// ── Σώμα ────────────────────────────────────────────────────────────────────────────────
// Laxity of a body region on the Pittsburgh scale (0 normal – 3 severe).
const region = (key: string, el: string, of: string, extra: Field[] = [], extraParts: string[] = []): Finding => ({
  key, el,
  fields: [
    { key: "pittsburgh", el: "Χαλάρωση (Pittsburgh)", type: "one", options: [
      o("1", "1 · ήπια", `ήπια χαλάρωση ${of} (Pittsburgh 1)`), o("2", "2 · μέτρια", `μέτρια χαλάρωση ${of} (Pittsburgh 2)`), o("3", "3 · σοβαρή", `σοβαρή χαλάρωση ${of} (Pittsburgh 3)`),
    ] },
    deg("fat", "Λιπώδης περίσσεια", [`ήπια λιπώδη περίσσεια ${of}`, `μέτρια λιπώδη περίσσεια ${of}`, `σημαντική λιπώδη περίσσεια ${of}`]),
    { key: "cellulite", el: "Κυτταρίτιδα", type: "bool", phrase: "κυτταρίτιδα" },
    ...extra,
  ],
  parts: ["{pittsburgh}", "{fat}", "{cellulite}", ...extraParts],
  empty: `ευρήματα ${of}`,
});

const BODY: AreaExam = {
  key: "body",
  findings: [
    {
      key: "abdomen", el: "Κοιλιά",
      fields: [
        { key: "matarasso", el: "Matarasso", type: "one", prefix: "κοιλιά ", options: [
          o("1", "I · μόνο λίπος", "Matarasso I (λιπώδης περίσσεια χωρίς χαλάρωση)"), o("2", "II · ήπια χαλάρωση κάτω από ομφαλό", "Matarasso II (ήπια χαλάρωση κάτω από τον ομφαλό)"),
          o("3", "III · μέτρια χαλάρωση & διάσταση", "Matarasso III (μέτρια χαλάρωση δέρματος και διάσταση ορθών)"), o("4", "IV · σοβαρή χαλάρωση & διάσταση", "Matarasso IV (σοβαρή χαλάρωση δέρματος και διάσταση ορθών)"),
        ] },
        { key: "pannus", el: "Ποδιά (pannus)", type: "one", prefix: "κρεμάμενη ποδιά ", options: [
          o("1", "1 · ηβική γραμμή", "βαθμού 1 (έως την ηβική γραμμή)"), o("2", "2 · γεννητικά", "βαθμού 2 (καλύπτει τα γεννητικά)"),
          o("3", "3 · άνω μηροί", "βαθμού 3 (έως άνω μηρούς)"), o("4", "4 · μέσοι μηροί", "βαθμού 4 (έως μέσους μηρούς)"), o("5", "5 · γόνατα", "βαθμού 5 (έως γόνατα)"),
        ] },
        { key: "diastasis", el: "Διάσταση ορθών", type: "measure", unit: "cm", say: "διάσταση ορθών κοιλιακών", max: 20 },
        { key: "hernia", el: "Κήλη", type: "many", options: [o("umbilical", "ομφαλοκήλη"), o("epigastric", "επιγαστρική"), o("incisional", "μετεγχειρητική", "μετεγχειρητική κήλη")].map((x) => (x.key === "epigastric" ? { ...x, phrase: "επιγαστρική κήλη" } : x)) },
        { key: "striae", el: "Ραγάδες", type: "bool", phrase: "ραγάδες" },
        { key: "flanks", el: "Λαγόνια", type: "bool", phrase: "λιπώδη λαγόνια (flanks)" },
        { key: "scars", el: "Ουλές", type: "many", prefix: "ουλές (", suffix: ")", options: [o("cs", "καισαρική"), o("lap", "λαπαροσκοπικές"), o("open", "λαπαροτομία"), o("appendix", "σκωληκοειδεκτομή"), o("subcostal", "υποπλεύρια")] },
      ],
      parts: ["{matarasso}", "{pannus}", "{diastasis}", "{hernia}", "{striae}", "{flanks}", "{scars}"], empty: "ευρήματα κοιλιάς",
    },
    {
      key: "weightLoss", el: "Μαζική απώλεια βάρους",
      fields: [
        { key: "kg", el: "Κιλά", type: "measure", unit: "kg", say: "", prefix: "(", suffix: ")", max: 300 },
        { key: "how", el: "Τρόπος", type: "one", options: [o("diet", "δίαιτα", "με δίαιτα"), o("bariatric", "βαριατρική", "μετά από βαριατρική επέμβαση"), o("glp1", "GLP-1 (π.χ. σεμαγλουτίδη)", "με αγωνιστή GLP-1")] },
        { key: "stable", el: "Σταθερό βάρος ≥ 6 μήνες", type: "bool", phrase: "σταθερό βάρος τουλάχιστον 6 μήνες" },
      ],
      parts: ["μαζική απώλεια βάρους {kg} {how}", "{stable}"],
    },
    {
      key: "lipoedema", el: "Λιποίδημα",
      fields: [
        { key: "stage", el: "Στάδιο", type: "one", options: [
          o("1", "1 · λεία επιφάνεια", "σταδίου 1"), o("2", "2 · ανώμαλη, οζίδια", "σταδίου 2"),
          o("3", "3 · λοβοί / αναδιπλώσεις", "σταδίου 3"), o("4", "4 · λιπολεμφοίδημα", "σταδίου 4 (λιπολεμφοίδημα)"),
        ] },
        { key: "type", el: "Τύπος", type: "many", prefix: "κατανομή ", options: [
          o("1", "I · γλουτοί–ισχία", "τύπου I (γλουτοί–ισχία)"), o("2", "II · έως γόνατα", "τύπου II (έως γόνατα)"), o("3", "III · έως αστραγάλους", "τύπου III (έως αστραγάλους)"),
          o("4", "IV · βραχίονες", "τύπου IV (βραχίονες)"), o("5", "V · κνήμες", "τύπου V (κνήμες)"),
        ] },
        { key: "symptoms", el: "Συμπτώματα", type: "many", options: [o("pain", "πόνος στην ψηλάφηση"), o("bruising", "εύκολοι μώλωπες"), o("heavy", "αίσθημα βάρους"), o("evening", "οίδημα που επιδεινώνεται το βράδυ")] },
        { key: "cuff", el: "Σεβασμός άκρων ποδών", type: "bool", phrase: "σεβασμός άκρων ποδών (cuff sign)" },
        { key: "stemmer", el: "Stemmer", type: "one", options: [o("neg", "αρνητικό", "αρνητικό σημείο Stemmer"), o("pos", "θετικό", "θετικό σημείο Stemmer")] },
        { key: "compression", el: "Κάλτσες συμπίεσης", type: "bool", phrase: "χρήση καλτσών συμπίεσης" },
      ],
      parts: ["λιποίδημα {stage}", "{type}", "{symptoms}", "{cuff}", "{stemmer}", "{compression}"],
    },
    region("arms", "Βραχίονες", "βραχιόνων", [{ key: "chest", el: "Επέκταση στο θωρακικό τοίχωμα", type: "bool", phrase: "επέκταση στο πλάγιο θωρακικό τοίχωμα" }], ["{chest}"]),
    region("thighs", "Μηροί", "μηρών", [{ key: "zone", el: "Περιοχή", type: "many", prefix: "(", suffix: ")", options: [o("medial", "έσω"), o("lateral", "έξω"), o("circumferential", "περιμετρικά")] }], ["{zone}"]),
    region("buttocks", "Γλουτοί", "γλουτών", [{ key: "flat", el: "Επιπέδωση / απώλεια όγκου", type: "bool", phrase: "επιπέδωση γλουτών" }], ["{flat}"]),
    region("back", "Πλάτη", "πλάτης", [{ key: "rolls", el: "Δερματολιπώδεις πτυχές", type: "bool", phrase: "δερματολιπώδεις πτυχές πλάτης" }], ["{rolls}"]),
    region("mons", "Εφήβαιο", "εφηβαίου", [{ key: "ptosis", el: "Πτώση", type: "bool", phrase: "πτώση εφηβαίου" }], ["{ptosis}"]),
  ],
  previous: [
    o("abdominoplasty", "κοιλιοπλαστική"), o("miniAbdo", "mini κοιλιοπλαστική"), o("lipo", "λιποαναρρόφηση"), o("armLift", "βραχιονοπλαστική"),
    o("thighLift", "μηροπλαστική"), o("bodyLift", "body lift"), o("bbl", "μεταμόσχευση λίπους γλουτών"), o("bariatric", "βαριατρική επέμβαση"), o("cs", "καισαρική"),
  ],
  previousSay: "προηγούμενες επεμβάσεις",
};

// ── Γεννητικά ───────────────────────────────────────────────────────────────────────────
const GENITAL: AreaExam = {
  key: "genital",
  findings: [
    {
      key: "labiaMinora", el: "Μικρά χείλη",
      fields: [
        { key: "franco", el: "Franco", type: "one", prefix: "υπερτροφία μικρών χειλέων ", options: [
          o("1", "I · < 2 cm", "Franco I"), o("2", "II · 2–4 cm", "Franco II"), o("3", "III · 4–6 cm", "Franco III"), o("4", "IV · > 6 cm", "Franco IV"),
        ] },
        cm("length", "Προβολή", "προβολή", { max: 15 }),
        { key: "asym", el: "Ασυμμετρία", type: "bool", phrase: "ασυμμετρία" },
        { key: "pigment", el: "Υπέρχρωση", type: "bool", phrase: "υπέρχρωση" },
        { key: "symptoms", el: "Ενοχλήσεις", type: "many", prefix: "ενοχλήσεις: ", options: [o("friction", "τριβή / ερεθισμός"), o("sport", "δυσφορία στην άθληση"), o("intercourse", "δυσπαρεύνια"), o("hygiene", "δυσκολία υγιεινής"), o("clothing", "ενόχληση από ρούχα")] },
      ],
      parts: ["{franco|υπερτροφία μικρών χειλέων}", "{length}", "{asym}", "{pigment}", "{symptoms}"],
    },
    {
      key: "hood", el: "Κλειτοριδική πόσθη",
      fields: [deg("degree", "Περίσσεια", ["ήπια περίσσεια κλειτοριδικής πόσθης", "μέτρια περίσσεια κλειτοριδικής πόσθης", "σημαντική περίσσεια κλειτοριδικής πόσθης"])],
      parts: ["{degree}"], empty: "περίσσεια κλειτοριδικής πόσθης",
    },
    {
      key: "labiaMajora", el: "Μεγάλα χείλη",
      fields: [{ key: "kind", el: "Ευρήματα", type: "many", options: [o("atrophy", "ατροφία / απώλεια όγκου", "ατροφία μεγάλων χειλέων"), o("excess", "περίσσεια", "περίσσεια μεγάλων χειλέων"), o("laxity", "χαλαρό δέρμα", "χαλαρότητα δέρματος μεγάλων χειλέων")] }],
      parts: ["{kind}"], empty: "ευρήματα μεγάλων χειλέων",
    },
    {
      key: "vaginal", el: "Κόλπος / πυελικό έδαφος",
      fields: [
        { key: "laxity", el: "Αίσθημα χαλαρότητας", type: "bool", phrase: "αίσθημα χαλαρότητας κόλπου" },
        { key: "incontinence", el: "Ακράτεια προσπάθειας", type: "bool", phrase: "ακράτεια προσπάθειας" },
        { key: "dryness", el: "Ξηρότητα / ατροφία", type: "bool", phrase: "ξηρότητα κόλπου" },
      ],
      parts: ["{laxity}", "{incontinence}", "{dryness}"], empty: "ευρήματα κόλπου",
    },
    {
      key: "mtf", el: "Προϋποθέσεις MtF", sentence: "Προϋποθέσεις κολποπλαστικής MtF",
      fields: [
        { key: "hormones", el: "Ορμονοθεραπεία ≥ 12 μήνες", type: "bool", phrase: "ορμονοθεραπεία ≥ 12 μήνες" },
        { key: "letter", el: "Επιστολή εκτίμησης", type: "one", options: [o("yes", "υπάρχει", "επιστολή εκτίμησης ψυχικής υγείας (WPATH SOC-8)"), o("pending", "εκκρεμεί", "εκκρεμεί επιστολή εκτίμησης")] },
        { key: "hair", el: "Αποτρίχωση περιοχής", type: "one", options: [o("done", "ολοκληρωμένη", "ολοκληρωμένη αποτρίχωση"), o("ongoing", "σε εξέλιξη", "αποτρίχωση σε εξέλιξη"), o("no", "όχι", "χωρίς αποτρίχωση")] },
        { key: "capacity", el: "Ικανότητα συναίνεσης", type: "bool", phrase: "ικανότητα συναίνεσης" },
        { key: "stable", el: "Σταθερή ψυχική/σωματική υγεία", type: "bool", phrase: "σταθερή ψυχική και σωματική υγεία" },
      ],
      parts: ["{hormones}", "{letter}", "{hair}", "{capacity}", "{stable}"], empty: "υπό εκτίμηση",
    },
  ],
  previous: [o("labiaplasty", "χειλεοπλαστική"), o("vaginoplasty", "κολποπλαστική"), o("monsplasty", "επέμβαση εφηβαίου"), o("filler", "filler"), o("laser", "laser κόλπου"), o("orchiectomy", "ορχεκτομή")],
  previousSay: "προηγούμενες επεμβάσεις",
};

// ── Άλλο ────────────────────────────────────────────────────────────────────────────────
const OTHER: AreaExam = {
  key: "other",
  findings: [
    {
      key: "scar", el: "Ουλή",
      fields: [
        { key: "kind", el: "Είδος", type: "one", options: [o("hypertrophic", "υπερτροφική", "υπερτροφική ουλή"), o("keloid", "χηλοειδές", "χηλοειδές"), o("atrophic", "ατροφική", "ατροφική ουλή"), o("widened", "διευρυμένη", "διευρυμένη ουλή"), o("contracture", "με ρίκνωση", "ουλή με ρίκνωση")] },
        { key: "length", el: "Μήκος", type: "measure", unit: "cm", say: "μήκους", max: 100 },
        { key: "vss", el: "Vancouver (0–13)", type: "measure", unit: "/13", say: "Vancouver", max: 13 },
        { key: "symptoms", el: "Συμπτώματα", type: "many", options: [o("itch", "κνησμός"), o("pain", "πόνος"), o("restriction", "περιορισμός κίνησης")] },
      ],
      parts: ["{kind|ουλή} {length}", "{vss}", "{symptoms}"],
    },
    {
      key: "lesion", el: "Δερματική βλάβη",
      fields: [
        { key: "kind", el: "Κλινικά", type: "one", options: [
          o("nevus", "σπίλος"), o("seb", "σμηγματορροϊκή υπερκεράτωση"), o("cyst", "κύστη"), o("lipoma", "λίπωμα"),
          o("bcc", "ύποπτο BCC", "βλάβη ύποπτη για βασικοκυτταρικό καρκίνωμα"), o("scc", "ύποπτο SCC", "βλάβη ύποπτη για ακανθοκυτταρικό καρκίνωμα"), o("melanoma", "ύποπτο μελάνωμα", "βλάβη ύποπτη για μελάνωμα"),
        ] },
        { key: "size", el: "Διάμετρος", type: "measure", unit: "mm", say: "διαμέτρου", max: 300 },
        { key: "abcde", el: "ABCDE", type: "many", prefix: "ABCDE: ", options: [o("a", "ασυμμετρία"), o("b", "ανώμαλα όρια"), o("c", "πολυχρωμία"), o("d", "> 6 mm"), o("e", "μεταβολή")] },
      ],
      parts: ["{kind|δερματική βλάβη} {size}", "{abcde}"],
    },
  ],
  previous: [o("excision", "εκτομή"), o("scarRevision", "διόρθωση ουλής"), o("graft", "μόσχευμα δέρματος"), o("laser", "laser"), o("steroid", "ενέσεις κορτικοστεροειδούς")],
  previousSay: "προηγούμενες θεραπείες",
};

export const EXAMS: Record<string, AreaExam> = { breast: BREAST, face: FACE, nose: NOSE, body: BODY, genital: GENITAL, other: OTHER };
