import { describe, expect, it } from "vitest";
import { EXAMS, missingMeasurements, requiredBreastMeasurements } from "./areas";
import { cleanExam, difficultyModifiers, summarize } from "./engine";

const write = (area: string, raw: unknown, age: number | null = 43) => summarize(EXAMS[area], cleanExam(EXAMS[area], raw)!, age);

describe("breast / chest examination", () => {
  it("writes the findings as a sentence (the example from the surgeon)", () => {
    expect(
      write("breast", {
        findings: {
          laxity: { degree: "moderate" },
          volume: { kind: "loss", degree: "moderate" },
          asymmetry: { bigger: "right", degree: "mild", aspects: ["volume"] },
        },
      }),
    ).toBe("Ασθενής 43 ετών με μέτρια απώλεια όγκου, ήπια ασυμμετρία σε όγκο, με μεγαλύτερο τον δεξιό μαστό και μέτρια χαλαρότητα δέρματος.");
  });

  it("adds measurements, the revision history and implant findings", () => {
    expect(
      write("breast", {
        findings: { ptosis: { grade: "2", side: "both" }, implants: { baker: "3", rippling: true, side: "left" } },
        measurements: { jmd: { r: "23,5", l: 22 }, bw: { r: 12 }, intermammary: { v: 2 }, nml: { r: "" } },
        revision: { previous: [{ key: "augmentation", year: "2015" }, { key: "bogus" }] },
        difficulty: 6,
      }, 50),
    ).toBe(
      "Ασθενής 50 ετών με μέτρια πτώση (Regnault II) αμφοτερόπλευρα. Μετρήσεις (Δ/Α): JMD 23,5/22 cm, BW Δ 12 cm, μεσομαστική απόσταση 2 cm. " +
        "Αναθεώρηση· προηγούμενες επεμβάσεις μαστού/θώρακα: αυξητική μαστού (2015). Ευρήματα ενθεμάτων: καψική σύσπαση Baker III, ρυτίδωση (rippling) αριστερά.",
    );
  });

  it("documents gynaecomastia and top surgery separately", () => {
    expect(
      write("breast", {
        findings: {
          gynaecomastia: { simon: "2b", kind: "glandular", side: "both" },
          topSurgery: { identity: "nonBinary", dysphoria: true, binder: "gt8", hormones: "on", months: { v: 18 }, letter: "yes" },
        },
      }, 24),
    ).toBe(
      "Ασθενής 24 ετών με γυναικομαστία Simon IIb, αδενικού τύπου αμφοτερόπλευρα. Εκτίμηση για top surgery: μη δυαδικό άτομο, " +
        "τεκμηριωμένη επίμονη δυσφορία φύλου σχετική με τον θώρακα, binder ≥ 8 ώρες/ημέρα, σε τεστοστερόνη επί 18 μήνες, επιστολή εκτίμησης ψυχικής υγείας (WPATH SOC-8).",
    );
  });

  it("drops unknown findings, options and impossible numbers, and implant findings without a revision", () => {
    const exam = cleanExam(EXAMS.breast, { findings: { ptosis: { grade: "9" }, moon: {}, implants: { baker: "3" } }, measurements: { jmd: { r: 500 } }, difficulty: 11 });
    expect(exam).toEqual({ findings: { ptosis: {} } });
  });

  it("asks for JMD, nipple–fold and base width before breast surgery; the areola instead for chest surgery", () => {
    expect(requiredBreastMeasurements(["facelift"])).toEqual([]);
    expect(requiredBreastMeasurements(["augmentation", "topSurgery"])).toEqual(["jmd", "nimfStretch", "bw"]);
    expect(requiredBreastMeasurements(["topSurgery"])).toEqual(["jmd", "nimfStretch", "areola"]);
    expect(missingMeasurements({ findings: {}, measurements: { jmd: { r: 21 } } }, ["jmd", "bw"])).toEqual(["bw"]);
  });
});

describe("other areas", () => {
  it("face: eyelids with MRD1, neck with Dedo and submandibular glands", () => {
    expect(
      write("face", {
        findings: {
          upperLids: { derm: "moderate", fat: ["medial"], mrd1: { r: 2, l: 3.5 }, side: "both" },
          neck: { dedo: "3", gland: "visible", bands: "dynamic" },
          midface: { deflation: "mild" },
        },
      }, 58),
    ).toBe(
      "Ασθενής 58 ετών με μέτρια δερματόχαλαση άνω βλεφάρων, προβολή λίπους (έσω), MRD1 2/3,5 mm (Δ/Α) αμφοτερόπλευρα, " +
        "ήπια απώλεια όγκου μέσου προσώπου και τράχηλο Dedo III (υπογένειο λίπος), δυναμικές πλατυσματικές ταινίες, ορατή πτώση υπογνάθιων αδένων.",
    );
  });

  it("nose: findings and angles", () => {
    expect(
      write("nose", { findings: { dorsum: { hump: "moderate" }, airway: { septum: "anterior", septumTo: "left", internal: true } }, measurements: { nasolabial: { v: 88 }, goode: { v: "0,62" } } }, 27),
    ).toBe(
      "Ασθενής 27 ετών με μέτριο κύρτωμα ράχης και πρόσθια απόκλιση διαφράγματος προς τα αριστερά, ανεπάρκεια έσω βαλβίδας (Cottle θετικό). " +
        "Μετρήσεις: ρινοχειλική γωνία 88°, λόγος Goode 0,62.",
    );
  });

  it("body: Matarasso with diastasis, lipoedema stage and type, weight loss", () => {
    expect(
      write("body", {
        findings: {
          abdomen: { matarasso: "3", diastasis: { v: 4 } },
          lipoedema: { stage: "2", type: ["1", "2"], symptoms: ["pain", "bruising"], cuff: true },
          weightLoss: { kg: { v: 45 }, how: "bariatric" },
        },
      }, 39),
    ).toBe(
      "Ασθενής 39 ετών με κοιλιά Matarasso III (μέτρια χαλάρωση δέρματος και διάσταση ορθών), διάσταση ορθών κοιλιακών 4 cm, " +
        "μαζική απώλεια βάρους (45 kg) μετά από βαριατρική επέμβαση και λιποίδημα σταδίου 2, κατανομή τύπου I (γλουτοί–ισχία) και τύπου II (έως γόνατα), " +
        "πόνος στην ψηλάφηση και εύκολοι μώλωπες, σεβασμός άκρων ποδών (cuff sign).",
    );
  });

  it("genital and other: Franco, scars", () => {
    expect(write("genital", { findings: { labiaMinora: { franco: "2", length: { r: 3, l: 4 }, symptoms: ["friction"] } } }, 30)).toBe(
      "Ασθενής 30 ετών με υπερτροφία μικρών χειλέων Franco II, προβολή 3/4 cm (Δ/Α), ενοχλήσεις: τριβή / ερεθισμός.",
    );
    expect(write("other", { findings: { scar: { kind: "hypertrophic", length: { v: 6 }, vss: { v: 7 } } } }, null)).toBe(
      "Ασθενής με υπερτροφική ουλή μήκους 6 cm, Vancouver 7/13.",
    );
  });

  it("a ticked finding with no details still says something; every area has previous operations", () => {
    expect(write("face", { findings: { jowls: {} } }, 60)).toBe("Ασθενής 60 ετών με jowls.");
    for (const a of Object.values(EXAMS)) expect(a.previous.length).toBeGreaterThan(0);
  });

  it("difficulty: rank 1 is standard; each rank above adds 5% and 10 minutes", () => {
    expect(difficultyModifiers(1)).toEqual({ feePercent: 0, extraMinutes: 0 });
    expect(difficultyModifiers(4)).toEqual({ feePercent: 15, extraMinutes: 30 });
    expect(difficultyModifiers(10)).toEqual({ feePercent: 45, extraMinutes: 90 });
    expect(difficultyModifiers(undefined)).toEqual({ feePercent: 0, extraMinutes: 0 });
  });
});
