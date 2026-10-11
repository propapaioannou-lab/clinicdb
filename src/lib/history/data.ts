// The shape of one saved medical history (SPEC §4). Stored as JSON in each version.
import { ALLERGY_CHOICES, MEDICATION_CHOICES } from "./choices";

export type YesNo = "yes" | "no";
// d = details / notes; items = quick picks (medication and allergies).
export type Answer = { a: YesNo; d?: string; items?: string[] };

export const SMOKING = ["yes", "no", "former"] as const;
export const PER_DAY = ["0-5", "5-20", "20+"] as const;
export const PRODUCTS = ["cigarette", "ecig", "heated"] as const;

export type Smoking = {
  a: (typeof SMOKING)[number];
  perDay?: (typeof PER_DAY)[number];
  product?: (typeof PRODUCTS)[number];
  // Former smokers: when they stopped.
  quit?: string;
};

export type PreviousSurgery = { procedure: string; year?: string; complications?: string };

export type HistoryData = {
  // Questionnaire answers, by question key.
  answers: Record<string, Answer>;
  medication?: Answer;
  allergies?: Answer;
  smoking?: Smoking;
  weightKg?: number;
  maxWeightKg?: number;
  heightCm?: number;
  surgeries?: { a: YesNo; items: PreviousSurgery[]; notes?: string };
  notes?: string;
};

const TEXT_MAX = 2000;

function text(v: unknown, max = TEXT_MAX): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim().slice(0, max);
  return t || undefined;
}

function yesNo(v: unknown): YesNo | undefined {
  return v === "yes" || v === "no" ? v : undefined;
}

function answer(v: unknown, choices: readonly string[] = []): Answer | undefined {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  const a = yesNo(o.a);
  if (!a) return undefined;
  // Details and picks only make sense for "yes".
  if (a === "no") return { a };
  const out: Answer = { a };
  const d = text(o.d);
  if (d) out.d = d;
  const items = Array.isArray(o.items) ? [...new Set(o.items.filter((i): i is string => choices.includes(i as string)))] : [];
  if (items.length) out.items = items;
  return out;
}

function oneOf<T extends readonly string[]>(list: T, v: unknown): T[number] | undefined {
  return list.includes(v as string) ? (v as T[number]) : undefined;
}

function number(v: unknown, min: number, max: number): number | undefined {
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : v;
  if (typeof n !== "number" || !Number.isFinite(n) || n < min || n > max) return undefined;
  return Math.round(n * 10) / 10;
}

// Whatever arrives from the browser is rebuilt from scratch: unknown questions, wrong
// types and out-of-range numbers are dropped, texts trimmed and capped.
export function cleanHistory(raw: unknown, questionKeys: Set<string>): HistoryData {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const answers: Record<string, Answer> = {};
  const rawAnswers = (o.answers && typeof o.answers === "object" ? o.answers : {}) as Record<string, unknown>;
  for (const [k, v] of Object.entries(rawAnswers)) {
    if (!questionKeys.has(k)) continue;
    const a = answer(v);
    if (a) answers[k] = a;
  }
  const data: HistoryData = { answers };
  const medication = answer(o.medication, MEDICATION_CHOICES);
  if (medication) data.medication = medication;
  const allergies = answer(o.allergies, ALLERGY_CHOICES);
  if (allergies) data.allergies = allergies;

  const s = (o.smoking && typeof o.smoking === "object" ? o.smoking : null) as Record<string, unknown> | null;
  const smokingA = s && oneOf(SMOKING, s.a);
  if (s && smokingA) {
    const smoking: Smoking = { a: smokingA };
    if (smokingA === "yes") {
      const perDay = oneOf(PER_DAY, s.perDay);
      const product = oneOf(PRODUCTS, s.product);
      if (perDay) smoking.perDay = perDay;
      if (product) smoking.product = product;
    }
    if (smokingA === "former") {
      const quit = text(s.quit, 100);
      if (quit) smoking.quit = quit;
    }
    data.smoking = smoking;
  }

  const weightKg = number(o.weightKg, 20, 400);
  const maxWeightKg = number(o.maxWeightKg, 20, 400);
  const heightCm = number(o.heightCm, 50, 250);
  if (weightKg !== undefined) data.weightKg = weightKg;
  if (maxWeightKg !== undefined) data.maxWeightKg = maxWeightKg;
  if (heightCm !== undefined) data.heightCm = heightCm;

  const sg = (o.surgeries && typeof o.surgeries === "object" ? o.surgeries : null) as Record<string, unknown> | null;
  const sgA = sg && yesNo(sg.a);
  if (sg && sgA) {
    const items = sgA === "yes" && Array.isArray(sg.items) ? sg.items : [];
    data.surgeries = {
      a: sgA,
      items: items
        .slice(0, 50)
        .map((it) => {
          const r = (it && typeof it === "object" ? it : {}) as Record<string, unknown>;
          const procedure = text(r.procedure, 200);
          if (!procedure) return null;
          const item: PreviousSurgery = { procedure };
          const year = text(r.year, 20);
          const complications = text(r.complications, 500);
          if (year) item.year = year;
          if (complications) item.complications = complications;
          return item;
        })
        .filter((x): x is PreviousSurgery => x !== null),
    };
    const surgeryNotes = sgA === "yes" ? text(sg.notes) : undefined;
    if (surgeryNotes) data.surgeries.notes = surgeryNotes;
  }

  const notes = text(o.notes, 5000);
  if (notes) data.notes = notes;
  return data;
}

export function emptyHistory(): HistoryData {
  return { answers: {} };
}

// BMI from weight and height, one decimal.
export function bmi(weightKg?: number, heightCm?: number): number | null {
  if (!weightKg || !heightCm) return null;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

// What changed between two versions, by name only (values stay in the versions).
export function changedParts(before: HistoryData | null, after: HistoryData): string[] {
  const b = before ?? emptyHistory();
  const out: string[] = [];
  const keys = new Set([...Object.keys(b.answers), ...Object.keys(after.answers)]);
  for (const k of keys) if (JSON.stringify(b.answers[k]) !== JSON.stringify(after.answers[k])) out.push(k);
  for (const k of ["medication", "allergies", "smoking", "weightKg", "maxWeightKg", "heightCm", "surgeries", "notes"] as const) {
    if (JSON.stringify(b[k]) !== JSON.stringify(after[k])) out.push(k);
  }
  return out;
}

// How many questionnaire items have an answer (for "x / y απαντήθηκαν").
export function answeredCount(data: HistoryData, questionKeys: string[]) {
  const fixed = [data.medication, data.allergies, data.smoking, data.surgeries];
  return {
    answered: questionKeys.filter((k) => data.answers[k]).length + fixed.filter(Boolean).length,
    total: questionKeys.length + fixed.length,
  };
}

// "Όλα Όχι": every question still unanswered becomes No. Nothing already answered changes.
export function allUnansweredNo(data: HistoryData, questionKeys: string[]): HistoryData {
  const answers = { ...data.answers };
  for (const k of questionKeys) if (!answers[k]) answers[k] = { a: "no" };
  return {
    ...data,
    answers,
    medication: data.medication ?? { a: "no" },
    allergies: data.allergies ?? { a: "no" },
    smoking: data.smoking ?? { a: "no" },
    surgeries: data.surgeries ?? { a: "no", items: [] },
  };
}
