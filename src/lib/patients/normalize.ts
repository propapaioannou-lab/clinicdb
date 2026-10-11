// Turning names, phones and emails into forms that are easy to search and compare.

const stripAccents = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "");

// Greek letter pairs that sound like one letter, then single letters, into Latin.
const GREEK_PAIRS: [string, string][] = [
  ["ου", "u"], ["αι", "e"], ["ει", "i"], ["οι", "i"], ["υι", "i"],
  ["αυ", "av"], ["ευ", "ev"], ["μπ", "b"], ["ντ", "d"], ["γγ", "g"], ["γκ", "g"],
];
const GREEK_LETTERS: Record<string, string> = {
  α: "a", β: "v", γ: "g", δ: "d", ε: "e", ζ: "z", η: "i", θ: "8", ι: "i", κ: "k",
  λ: "l", μ: "m", ν: "n", ξ: "x", ο: "o", π: "p", ρ: "r", σ: "s", ς: "s", τ: "t",
  υ: "i", φ: "f", χ: "x", ψ: "ps", ω: "o",
};
// The same idea for Greeklish, which is written in many ways (Papadopoulou, Papadopulu...).
const LATIN_PAIRS: [string, string][] = [
  ["ou", "u"], ["ai", "e"], ["ei", "i"], ["oi", "i"], ["ch", "x"], ["ks", "x"],
  ["ph", "f"], ["th", "8"], ["mp", "b"], ["nt", "d"], ["gk", "g"], ["gg", "g"], ["ng", "g"],
];
// θ is kept as "8" (also how it is often typed), so a lone "h" can stand for χ (Hristos).
const LATIN_LETTERS: Record<string, string> = { y: "i", w: "o", h: "x", c: "k", q: "k", j: "g" };

function replacePairs(s: string, pairs: [string, string][]) {
  for (const [from, to] of pairs) s = s.split(from).join(to);
  return s;
}

// "Παπαδοπούλου" and "papadopoulou" both become "papadopulu".
// Used for the stored search name and for whatever is typed in the search box.
export function searchKey(text: string): string {
  let s = stripAccents(text.toLowerCase());
  s = replacePairs(s, GREEK_PAIRS);
  s = s.replace(/[α-ως]/g, (c) => GREEK_LETTERS[c] ?? c);
  s = replacePairs(s, LATIN_PAIRS);
  s = s.replace(/[a-z]/g, (c) => LATIN_LETTERS[c] ?? c);
  return s
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/(.)\1+/g, "$1") // Παππάς = Papas
    .replace(/\s+/g, " ")
    .trim();
}

// Capitals without accents, so "Άννα" sorts with "Α", not after "Ω".
export function sortKey(text: string): string {
  return stripAccents(text).toUpperCase().replace(/\s+/g, " ").trim();
}

export function patientSearchName(p: { surname: string; firstName?: string | null }) {
  return searchKey(`${p.surname} ${p.firstName ?? ""}`);
}

export function patientSortName(p: { surname: string; firstName?: string | null }) {
  return sortKey(`${p.surname} ${p.firstName ?? ""}`);
}

// "+30 694-123 4567", "0030 6941234567" and "6941234567" all become "6941234567".
export function phoneDigits(phone: string): string {
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("0030")) d = d.slice(4);
  else if (d.startsWith("30") && d.length === 12) d = d.slice(2);
  return d;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Age in whole years and months on a given day (birthdays use the Athens date).
export function ageOn(birthDate: Date, today: { year: number; month: number; day: number }) {
  const by = birthDate.getUTCFullYear();
  const bm = birthDate.getUTCMonth() + 1;
  const bd = birthDate.getUTCDate();
  let months = (today.year - by) * 12 + (today.month - bm);
  if (today.day < bd) months -= 1;
  if (months < 0) return null;
  return { years: Math.floor(months / 12), months: months % 12 };
}

// "15/6/1980" (day/month/year, as typed in the form) -> a date. Impossible dates such as
// 31/02 are rejected rather than rolled over. Empty -> null.
export function parseDayMonthYear(v: string | null): Date | null | "invalid" {
  if (!v?.trim()) return null;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v.trim());
  if (!m) return "invalid";
  const [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return "invalid";
  return d;
}
