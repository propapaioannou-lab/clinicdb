// Structured examination engine (decided 11 Oct 2026): each examined area is described as
// data — findings with multiple-choice / yes-no / measurement fields — and the findings
// are written up as Greek sentences into the visit's "Επιπλέον ευρήματα". Areas live in
// ./areas/*. Difficulty 1–10: rank 1 = standard, each rank above adds +5% fee and +10′.

export type Opt = { key: string; el: string; phrase?: string };

type FieldBase = { key: string; el: string; prefix?: string; suffix?: string };
export type Field =
  | (FieldBase & { type: "one" | "many"; options: Opt[] })
  | (FieldBase & { type: "bool"; phrase: string })
  // A measurement; `sides` = right/left values. `say` = how it is named in the sentence.
  | (FieldBase & { type: "measure"; unit: string; sides?: boolean; say?: string; min?: number; max?: number });

export type Finding = {
  key: string;
  el: string;
  fields: Field[];
  // Sentence pieces with {field} or {field|fallback}; empty pieces are dropped, the rest
  // joined with ", ". A piece with plain words in it is therefore always kept.
  parts: string[];
  // Added after the pieces (e.g. "{side}").
  after?: string;
  // Only offered in a revision case (e.g. implant findings).
  revisionOnly?: boolean;
  // Written as its own sentence: "Ευρήματα ενθεμάτων: …".
  sentence?: string;
  // Phrase when the finding is ticked but none of its details are.
  empty?: string;
  // Heading the chip is listed under (e.g. "Γυναικομαστία", "Top surgery").
  group?: string;
};

export type AreaExam = {
  key: string;
  findings: Finding[];
  // Area-wide measurements block (breast, nose), written as "Μετρήσεις: …".
  measurements?: { title: string; note?: string; fields: Field[] };
  // Groups of finding chips, in display order (findings without a group come first).
  groups?: string[];
  // Previous operations in this area for a revision case (year typed by hand).
  previous: Opt[];
  previousSay: string;
};

export type MeasureValue = { r?: number; l?: number; v?: number };
export type FieldValue = string | string[] | boolean | MeasureValue;
export type FindingValue = Record<string, FieldValue>;
export type ExamValue = {
  findings: Record<string, FindingValue>;
  measurements?: Record<string, MeasureValue>;
  revision?: { previous: { key: string; year?: string }[] };
  difficulty?: number;
};

const o = (key: string, el: string, phrase?: string): Opt => ({ key, el, ...(phrase !== undefined && { phrase }) });
export { o as opt };
export const DEGREE = [o("mild", "ήπια"), o("moderate", "μέτρια"), o("severe", "σοβαρή")];
export const SIDE = [o("both", "αμφοτερόπλευρα"), o("right", "δεξιά"), o("left", "αριστερά")];

// Rank 1 = standard case; each rank above adds 5% fee and 10 minutes (decided 11 Oct 2026).
export function difficultyModifiers(rank: number | undefined) {
  const steps = rank && rank > 1 ? Math.min(rank, 10) - 1 : 0;
  return { feePercent: steps * 5, extraMinutes: steps * 10 };
}

const num = (n: number) => n.toLocaleString("el-GR", { maximumFractionDigits: 2 });
const unitAfter = (u: string) => (!u || u === "°" || u.startsWith("/") ? u : ` ${u}`);

// "MRD1 2/3 mm (Δ/Α)", "MRD1 Δ 2 mm", "ρινοχειλική γωνία 95°".
export function formatMeasure(f: Extract<Field, { type: "measure" }>, v: MeasureValue | undefined, inBlock = false): string {
  if (!v) return "";
  const name = f.say ?? f.el;
  if (!f.sides) return v.v === undefined ? "" : `${name} ${num(v.v)}${unitAfter(f.unit)}`;
  if (v.r !== undefined && v.l !== undefined) return `${name} ${num(v.r)}/${num(v.l)}${unitAfter(f.unit)}${inBlock ? "" : " (Δ/Α)"}`;
  if (v.r !== undefined) return `${name} Δ ${num(v.r)}${unitAfter(f.unit)}`;
  if (v.l !== undefined) return `${name} Α ${num(v.l)}${unitAfter(f.unit)}`;
  return "";
}

export const joinAnd = (parts: string[]) => (parts.length <= 1 ? parts.join("") : `${parts.slice(0, -1).join(", ")} και ${parts.at(-1)}`);

function fieldPhrase(field: Field | undefined, value: FieldValue | undefined): string {
  if (!field || value === undefined) return "";
  let text = "";
  if (field.type === "bool") text = value === true ? field.phrase : "";
  if (field.type === "one" && typeof value === "string") {
    const op = field.options.find((x) => x.key === value);
    text = op ? (op.phrase ?? op.el) : "";
  }
  if (field.type === "many" && Array.isArray(value)) {
    text = joinAnd(value.map((k) => field.options.find((x) => x.key === k)).filter((x): x is Opt => !!x).map((x) => x.phrase ?? x.el));
  }
  if (field.type === "measure" && typeof value === "object" && !Array.isArray(value)) text = formatMeasure(field, value as MeasureValue);
  return text ? `${field.prefix ?? ""}${text}${field.suffix ?? ""}` : "";
}

const tidy = (s: string) =>
  s.replace(/\s+/g, " ").replace(/\s+([,.)])/g, "$1").replace(/\(\s+/g, "(").replace(/^[\s,]+|[\s,]+$/g, "").trim();

function fill(template: string, finding: Finding, v: FindingValue): string {
  const text = template.replace(/\{([^}|]+)(?:\|([^}]*))?\}/g, (_, key: string, fallback?: string) => {
    const phrase = fieldPhrase(finding.fields.find((f) => f.key === key), v[key]);
    return phrase || fallback || "";
  });
  return tidy(text);
}

export function findingPhrase(finding: Finding, v: FindingValue): string | null {
  const parts = finding.parts.map((p) => fill(p, finding, v)).filter(Boolean);
  if (!parts.length) return finding.empty ?? null;
  const after = finding.after ? fill(finding.after, finding, v) : "";
  return tidy(`${parts.join(", ")} ${after}`);
}

// The whole write-up for one area, e.g. "Ασθενής 43 ετών με … . Μετρήσεις (Δ/Α): … ."
export function summarize(area: AreaExam, exam: ExamValue, ageYears: number | null): string {
  const sentences: string[] = [];
  const main = area.findings
    .filter((f) => !f.sentence && (!f.revisionOnly || exam.revision) && exam.findings[f.key])
    .map((f) => findingPhrase(f, exam.findings[f.key]))
    .filter((p): p is string => !!p);
  const who = ageYears !== null ? `Ασθενής ${ageYears} ετών` : "Ασθενής";
  if (main.length) sentences.push(`${who} με ${joinAnd(main)}.`);
  if (area.measurements && exam.measurements) {
    const m = area.measurements.fields
      .map((f) => (f.type === "measure" ? formatMeasure(f, exam.measurements![f.key], true) : ""))
      .filter(Boolean);
    const sided = area.measurements.fields.some((f) => f.type === "measure" && f.sides && exam.measurements![f.key]);
    if (m.length) sentences.push(`Μετρήσεις${sided ? " (Δ/Α)" : ""}: ${m.join(", ")}.`);
  }
  if (exam.revision) {
    const list = exam.revision.previous
      .map((p) => {
        const op = area.previous.find((x) => x.key === p.key);
        return op ? `${op.phrase ?? op.el}${p.year ? ` (${p.year})` : ""}` : null;
      })
      .filter(Boolean);
    sentences.push(list.length ? `Αναθεώρηση· ${area.previousSay}: ${list.join(", ")}.` : "Αναθεώρηση μετά από προηγούμενη επέμβαση.");
  }
  for (const f of area.findings.filter((x) => x.sentence && (!x.revisionOnly || exam.revision) && exam.findings[x.key])) {
    const p = findingPhrase(f, exam.findings[f.key]);
    if (p) sentences.push(`${f.sentence}: ${p}.`);
  }
  return sentences.join(" ");
}

function cleanMeasure(f: Extract<Field, { type: "measure" }>, raw: unknown): MeasureValue | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const ok = (x: unknown) => {
    const n = typeof x === "string" ? (x.trim() ? Number(x.replace(",", ".")) : NaN) : x;
    return typeof n === "number" && Number.isFinite(n) && n >= (f.min ?? 0) && n <= (f.max ?? 1000) ? Math.round(n * 100) / 100 : undefined;
  };
  const out: MeasureValue = {};
  if (f.sides) {
    const a = ok(r.r);
    const b = ok(r.l);
    if (a !== undefined) out.r = a;
    if (b !== undefined) out.l = b;
  } else {
    const v = ok(r.v);
    if (v !== undefined) out.v = v;
  }
  return Object.keys(out).length ? out : null;
}

function cleanField(f: Field, v: unknown): FieldValue | undefined {
  if (f.type === "bool") return v === true ? true : undefined;
  if (f.type === "measure") return cleanMeasure(f, v) ?? undefined;
  const keys = new Set(f.options.map((x) => x.key));
  if (f.type === "one") return typeof v === "string" && keys.has(v) ? v : undefined;
  if (Array.isArray(v)) {
    const list = [...new Set(v.filter((x): x is string => typeof x === "string" && keys.has(x)))];
    return list.length ? list : undefined;
  }
  return undefined;
}

// Rebuilt from the browser: unknown findings, fields, options and out-of-range numbers
// are dropped.
export function cleanExam(area: AreaExam, raw: unknown): ExamValue | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const revisionOn = !!r.revision && typeof r.revision === "object";
  const rawFindings = (r.findings && typeof r.findings === "object" ? r.findings : {}) as Record<string, unknown>;
  const findings: Record<string, FindingValue> = {};
  for (const f of area.findings) {
    if (!(f.key in rawFindings) || (f.revisionOnly && !revisionOn)) continue;
    const src = (rawFindings[f.key] && typeof rawFindings[f.key] === "object" ? rawFindings[f.key] : {}) as Record<string, unknown>;
    const val: FindingValue = {};
    for (const field of f.fields) {
      const v = cleanField(field, src[field.key]);
      if (v !== undefined) val[field.key] = v;
    }
    findings[f.key] = val;
  }
  const exam: ExamValue = { findings };
  if (area.measurements && r.measurements && typeof r.measurements === "object") {
    const m: Record<string, MeasureValue> = {};
    for (const f of area.measurements.fields) {
      if (f.type !== "measure") continue;
      const v = cleanMeasure(f, (r.measurements as Record<string, unknown>)[f.key]);
      if (v) m[f.key] = v;
    }
    if (Object.keys(m).length) exam.measurements = m;
  }
  if (revisionOn) {
    const keys = new Set(area.previous.map((x) => x.key));
    const prev = Array.isArray((r.revision as Record<string, unknown>).previous) ? ((r.revision as Record<string, unknown>).previous as unknown[]) : [];
    exam.revision = {
      previous: prev
        .map((p) => (p && typeof p === "object" ? (p as Record<string, unknown>) : {}))
        .filter((p) => typeof p.key === "string" && keys.has(p.key))
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
