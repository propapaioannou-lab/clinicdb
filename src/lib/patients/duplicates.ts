import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { patientSearchName, phoneDigits, searchKey } from "./normalize";
import type { PatientInput } from "./manage";

// Live duplicate check (SPEC §6b): older patients often forget they came before.
// Warns, never blocks: shared phones and emails are normal in families.

export type DuplicateReason = "amka" | "phone" | "email" | "name_dob" | "similar_name" | "first_name_dob";
export type Strength = "strong" | "medium" | "weak";

const STRENGTH: Record<DuplicateReason, Strength> = {
  amka: "strong",
  phone: "strong",
  email: "strong",
  name_dob: "medium",
  similar_name: "weak",
  first_name_dob: "weak",
};
const RANK: Record<Strength, number> = { strong: 0, medium: 1, weak: 2 };
const LIMIT = 8;

const CANDIDATE_SELECT = {
  id: true,
  number: true,
  surname: true,
  firstName: true,
  fatherName: true,
  birthDate: true,
  amka: true,
  afm: true,
  address: true,
  city: true,
  postcode: true,
  occupation: true,
  registeredAt: true,
  company: { select: { code: true } },
  phones: { orderBy: { sortOrder: "asc" }, select: { number: true, digits: true, type: true, isMain: true } },
  emails: { orderBy: { sortOrder: "asc" }, select: { email: true } },
} satisfies Prisma.PatientSelect;

type Row = Prisma.PatientGetPayload<{ select: typeof CANDIDATE_SELECT }>;
export type DuplicateCandidate = Row & { reasons: DuplicateReason[]; strength: Strength };

export async function findDuplicates(
  companyId: string,
  input: Pick<PatientInput, "surname" | "firstName" | "birthDate" | "amka" | "phones" | "emails">,
  excludeId?: string,
): Promise<DuplicateCandidate[]> {
  const found = new Map<string, { row: Row; reasons: Set<DuplicateReason> }>();
  const add = (rows: Row[], reason: DuplicateReason) => {
    for (const row of rows) {
      if (row.id === excludeId) continue;
      const entry = found.get(row.id) ?? { row, reasons: new Set<DuplicateReason>() };
      entry.reasons.add(reason);
      found.set(row.id, entry);
    }
  };
  const base = { companyId, archivedAt: null };
  const take = LIMIT;
  const select = CANDIDATE_SELECT;

  const digits = [...new Set(input.phones.map((p) => phoneDigits(p.number)).filter((d) => d.length >= 8))];
  const key = patientSearchName(input);
  const queries: Promise<void>[] = [];
  if (input.amka) queries.push(db.patient.findMany({ where: { ...base, amka: input.amka }, select, take }).then((r) => add(r, "amka")));
  if (digits.length) {
    queries.push(db.patient.findMany({ where: { ...base, phones: { some: { digits: { in: digits } } } }, select, take }).then((r) => add(r, "phone")));
  }
  if (input.emails.length) {
    queries.push(db.patient.findMany({ where: { ...base, emails: { some: { email: { in: input.emails } } } }, select, take }).then((r) => add(r, "email")));
  }
  if (input.birthDate) {
    queries.push(db.patient.findMany({ where: { ...base, searchName: key, birthDate: input.birthDate }, select, take }).then((r) => add(r, "name_dob")));
    // Same first name and birthday, different surname: perhaps a married name.
    const first = searchKey(input.firstName);
    if (first) {
      queries.push(
        db.patient
          .findMany({ where: { ...base, birthDate: input.birthDate, searchName: { endsWith: ` ${first}` }, NOT: { searchName: key } }, select, take })
          .then((r) => add(r, "first_name_dob")),
      );
    }
  }
  if (key.length >= 4) {
    queries.push(
      db.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Patient"
        WHERE "companyId" = ${companyId} AND "archivedAt" IS NULL AND similarity("searchName", ${key}) >= 0.55
        ORDER BY similarity("searchName", ${key}) DESC LIMIT ${take}`.then(async (ids) => {
        if (ids.length) add(await db.patient.findMany({ where: { id: { in: ids.map((i) => i.id) } }, select }), "similar_name");
      }),
    );
  }
  await Promise.all(queries);

  // Pairs already marked "not the same person" stay quiet.
  if (excludeId && found.size) {
    const known = await db.patientNotDuplicate.findMany({
      where: {
        OR: [
          { patientAId: excludeId, patientBId: { in: [...found.keys()] } },
          { patientBId: excludeId, patientAId: { in: [...found.keys()] } },
        ],
      },
    });
    for (const k of known) found.delete(k.patientAId === excludeId ? k.patientBId : k.patientAId);
  }

  return [...found.values()]
    .map(({ row, reasons }) => {
      const list = [...reasons];
      const strength = list.map((r) => STRENGTH[r]).sort((a, b) => RANK[a] - RANK[b])[0];
      return { ...row, reasons: list, strength };
    })
    .sort((a, b) => RANK[a.strength] - RANK[b.strength] || a.surname.localeCompare(b.surname, "el"))
    .slice(0, LIMIT);
}
