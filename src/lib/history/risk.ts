import type { HistoryData } from "./data";

// High-risk profile (decided 11 Oct 2026): shown wherever the patient appears.
// Heavy smoker = more than 20 a day; blood thinners = anticoagulants or antiplatelets
// (from the medication picks or the "Αντιπηκτικά ή ασπιρίνη" question); thrombophilia or
// a past thrombosis / pulmonary embolism; thyroxine (T4).
export const RISK_FACTORS = ["heavySmoker", "bloodThinners", "thrombosis", "thyroxine"] as const;
export type RiskFactor = (typeof RISK_FACTORS)[number];

export function riskFactors(data: HistoryData): RiskFactor[] {
  const yes = (key: string) => data.answers[key]?.a === "yes";
  const meds = data.medication?.a === "yes" ? (data.medication.items ?? []) : [];
  const out: RiskFactor[] = [];
  if (data.smoking?.a === "yes" && data.smoking.perDay === "20+") out.push("heavySmoker");
  if (yes("anticoag") || meds.includes("anticoagulants") || meds.includes("antiplatelets")) out.push("bloodThinners");
  if (yes("thrombophilia") || yes("clot")) out.push("thrombosis");
  if (meds.includes("thyroxine")) out.push("thyroxine");
  return out;
}
