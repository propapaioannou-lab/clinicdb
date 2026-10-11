import { describe, expect, it } from "vitest";
import { breastSummary, cleanBreastExam, difficultyModifiers } from "./breast";

describe("breast examination", () => {
  it("writes the findings as a sentence (the example from the surgeon)", () => {
    const exam = cleanBreastExam({
      findings: {
        laxity: { degree: "moderate" },
        volume: { kind: "loss", degree: "moderate" },
        asymmetry: { bigger: "right", degree: "mild", aspects: ["volume"] },
      },
    })!;
    expect(breastSummary(exam, 43)).toBe(
      "Ασθενής 43 ετών με μέτρια απώλεια όγκου, ήπια ασυμμετρία σε όγκο, με μεγαλύτερο τον δεξιό μαστό και μέτρια χαλαρότητα δέρματος.",
    );
  });

  it("adds ptosis grade and side, and the revision history and implant findings", () => {
    const exam = cleanBreastExam({
      findings: { ptosis: { grade: "2", side: "both" }, implants: { baker: "3", rippling: true, side: "left" } },
      revision: { previous: [{ key: "augmentation", year: "2015" }, { key: "bogus" }] },
      difficulty: 6,
    })!;
    expect(breastSummary(exam, 50)).toBe(
      "Ασθενής 50 ετών με μέτρια πτώση (Regnault II) αμφοτερόπλευρα. Αναθεώρηση· προηγούμενες επεμβάσεις μαστού: αυξητική μαστού (2015). " +
        "Ευρήματα ενθεμάτων: καψική σύσπαση Baker III και ρυτίδωση (rippling) αριστερά.",
    );
    expect(exam.difficulty).toBe(6);
  });

  it("drops unknown findings and options, and implant findings without a revision", () => {
    const exam = cleanBreastExam({ findings: { ptosis: { grade: "9" }, moon: {}, implants: { baker: "3" } }, difficulty: 11 })!;
    expect(exam).toEqual({ findings: { ptosis: {} } });
  });

  it("difficulty: rank 1 is standard; each rank above adds 5% and 10 minutes", () => {
    expect(difficultyModifiers(1)).toEqual({ feePercent: 0, extraMinutes: 0 });
    expect(difficultyModifiers(4)).toEqual({ feePercent: 15, extraMinutes: 30 });
    expect(difficultyModifiers(10)).toEqual({ feePercent: 45, extraMinutes: 90 });
    expect(difficultyModifiers(undefined)).toEqual({ feePercent: 0, extraMinutes: 0 });
  });
});
