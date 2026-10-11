import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { canSeeContactDetails } from "@/lib/permissions";
import type { Actor } from "@/lib/users/manage";
import { normalizeEmail, phoneDigits, searchKey } from "./normalize";
import { companyFilter } from "./scope";

// What was typed, understood as name, number/phone/AMKA, or email.
export type ParsedQuery =
  | { kind: "empty" }
  | { kind: "name"; key: string; words: string[] }
  | { kind: "digits"; digits: string }
  | { kind: "email"; email: string };

export function parseQuery(raw: string): ParsedQuery {
  const q = raw.trim();
  if (!q) return { kind: "empty" };
  if (q.includes("@")) return { kind: "email", email: normalizeEmail(q) };
  if (/^[\d\s+\-().]+$/.test(q)) {
    const digits = q.replace(/\D/g, "");
    return digits ? { kind: "digits", digits } : { kind: "empty" };
  }
  const key = searchKey(q);
  return key ? { kind: "name", key, words: key.split(" ") } : { kind: "empty" };
}

// The search as a database filter. Guests may search by name and patient number only:
// phones, emails and AMKA would let them identify people (SPEC §11).
export function searchWhere(actor: Actor, q: ParsedQuery): Prisma.PatientWhereInput | null {
  const contacts = canSeeContactDetails(actor.level);
  switch (q.kind) {
    case "empty":
      return null;
    case "name":
      // Every typed word must appear, in any order ("μαρια παπαδ" finds Παπαδοπούλου Μαρία).
      return { AND: q.words.map((w) => ({ searchName: { contains: w } })) };
    case "email":
      return contacts ? { emails: { some: { email: { contains: q.email } } } } : { id: { in: [] } };
    case "digits": {
      const or: Prisma.PatientWhereInput[] = [];
      if (q.digits.length <= 9) or.push({ number: Number(q.digits) });
      if (contacts && q.digits.length >= 3) {
        or.push({ phones: { some: { digits: { contains: phoneDigits(q.digits) } } } });
        or.push({ amka: { startsWith: q.digits } });
      }
      return { OR: or };
    }
  }
}

const RESULT_SELECT = {
  id: true,
  number: true,
  surname: true,
  firstName: true,
  fatherName: true,
  birthDate: true,
  flag: true,
  infectiousDiseases: true,
  company: { select: { name: true } },
} satisfies Prisma.PatientSelect;

export const QUICK_LIMIT = 8;

// For the search box: best matches first. Exact patient number, then surnames that
// start with what was typed, then other matches, then (if nothing) near spellings.
export async function quickSearch(actor: Actor, raw: string) {
  const q = parseQuery(raw);
  const match = searchWhere(actor, q);
  if (!match) return [];
  const contacts = canSeeContactDetails(actor.level);
  const base: Prisma.PatientWhereInput = { companyId: { in: companyFilter(actor) }, archivedAt: null };
  const select = {
    ...RESULT_SELECT,
    ...(contacts && { phones: { where: { isMain: true }, select: { number: true }, take: 1 } }),
  };
  const order: Prisma.PatientOrderByWithRelationInput[] = [{ sortName: "asc" }, { number: "asc" }];

  const run = (where: Prisma.PatientWhereInput, take = QUICK_LIMIT) =>
    db.patient.findMany({ where: { ...base, ...where }, select, orderBy: order, take });
  type Row = Awaited<ReturnType<typeof run>>[number];

  const found: Row[] = [];
  const add = (rows: Row[]) => {
    for (const r of rows) if (found.length < QUICK_LIMIT && !found.some((f) => f.id === r.id)) found.push(r);
  };

  if (q.kind === "digits" && q.digits.length <= 9) {
    add(await run({ number: Number(q.digits) }));
  }
  if (q.kind === "name") {
    add(await run({ AND: [{ searchName: { startsWith: q.words[0] } }, match] }));
  }
  if (found.length < QUICK_LIMIT) {
    add(await run(match));
  }
  if (found.length === 0 && q.kind === "name" && q.key.length >= 4) {
    const ids = await similarNames(actor, q.key);
    if (ids.length) {
      const rows = await run({ id: { in: ids } });
      add(ids.map((id) => rows.find((r) => r.id === id)).filter((r) => r !== undefined));
    }
  }
  return found;
}

// Spelling mistakes ("Papadopolou"): closest names by trigram similarity.
async function similarNames(actor: Actor, key: string): Promise<string[]> {
  const companies = companyFilter(actor);
  if (!companies.length) return [];
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Patient"
    WHERE "companyId" = ANY(${companies}) AND "archivedAt" IS NULL
      AND ${key} <% "searchName"
    ORDER BY word_similarity(${key}, "searchName") DESC, "sortName"
    LIMIT ${QUICK_LIMIT}`;
  return rows.map((r) => r.id);
}
