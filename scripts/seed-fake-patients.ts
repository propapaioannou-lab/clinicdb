// FAKE patients for development and speed tests. Never run on the real server.
//   npm run db:fake               adds fake patients if there are none yet
//   npm run db:fake -- --replace  removes ALL patients first, then adds fake ones
import { db } from "../src/lib/db";
import type { PatientFlag, PhoneType, Sex } from "../src/generated/prisma/client";
import { normalizeEmail, patientSearchName, patientSortName, phoneDigits, searchKey } from "../src/lib/patients/normalize";
import { AREAS, CITIES, FEMALE_NAMES, MALE_NAMES, OCCUPATIONS, STREETS, SURNAMES } from "./fake-names";

const COUNTS = { surgery: 15000, spa: 600 };
const BATCH = 1000;

// Same numbers every run, so "patient 1234" is the same fake person each time.
let seed = 20261011;
function rand() {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}
const pick = <T,>(a: readonly T[]) => a[Math.floor(rand() * a.length)];
const chance = (p: number) => rand() < p;
const digits = (n: number) => Array.from({ length: n }, () => Math.floor(rand() * 10)).join("");
const pad = (n: number) => String(n).padStart(2, "0");

type FakePatient = {
  data: {
    number: number; surname: string; firstName: string; fatherName: string | null; sex: Sex;
    birthDate: Date | null; registeredAt: Date; occupation: string | null; area: string | null;
    address: string | null; city: string | null; postcode: string | null; country: string;
    amka: string | null; afm: string | null; infectiousDiseases: string | null; comments: string | null;
    flag: PatientFlag; flagNote: string | null; flagSetAt: Date | null; language: "EL" | "EN";
    marketingConsent: boolean; maritalStatusId: string | null; referralSourceId: string | null;
    taxOfficeId: string | null;
  };
  phones: { number: string; type: PhoneType; isMain: boolean }[];
  emails: string[];
  flagReasons: string[];
};

function fakePatient(number: number, lists: Record<string, string[]>): FakePatient {
  const sex: Sex = chance(0.85) ? "FEMALE" : "MALE";
  const [maleSurname, femaleSurname] = pick(SURNAMES);
  const surname = sex === "FEMALE" ? femaleSurname : maleSurname;
  const firstName = pick(sex === "FEMALE" ? FEMALE_NAMES : MALE_NAMES);
  const birthDate = chance(0.97)
    ? new Date(Date.UTC(1945 + Math.floor(rand() * 63), Math.floor(rand() * 12), 1 + Math.floor(rand() * 28)))
    : null;
  const registered = new Date(Date.UTC(2005, 0, 1) + rand() * (Date.UTC(2026, 9, 1) - Date.UTC(2005, 0, 1)));
  const [city, postPrefix] = pick(CITIES);

  const phones: FakePatient["phones"] = [{ number: `69${digits(8)}`, type: "MOBILE", isMain: true }];
  if (chance(0.25)) phones.push({ number: `2310${digits(6)}`, type: "HOME", isMain: false });
  if (chance(0.05)) phones.push({ number: `2310${digits(6)}`, type: "WORK", isMain: false });
  // Shown as typed, in different styles, like real data.
  for (const p of phones) {
    if (chance(0.3)) p.number = `${p.number.slice(0, 3)} ${p.number.slice(3, 6)} ${p.number.slice(6)}`;
    else if (chance(0.15)) p.number = `+30 ${p.number}`;
  }

  const emails = chance(0.7)
    ? [`${searchKey(firstName).replace(/ /g, "")}.${searchKey(surname).replace(/ /g, "")}${digits(2)}@example.com`]
    : [];

  let flag: PatientFlag = "NONE";
  if (chance(0.03)) flag = "YELLOW";
  else if (chance(0.01)) flag = "RED";
  const flagReasons = flag === "NONE" ? [] : [pick(lists.FLAG_REASON)];

  return {
    data: {
      number,
      surname,
      firstName,
      fatherName: chance(0.8) ? pick(MALE_NAMES) : null,
      sex,
      birthDate,
      registeredAt: registered,
      occupation: chance(0.6) ? pick(OCCUPATIONS) : null,
      area: chance(0.5) ? pick(AREAS) : null,
      address: chance(0.8) ? `${pick(STREETS)} ${1 + Math.floor(rand() * 150)}` : null,
      city,
      postcode: postPrefix + digits(5 - postPrefix.length),
      country: "Ελλάδα",
      amka: chance(0.6) && birthDate
        ? `${pad(birthDate.getUTCDate())}${pad(birthDate.getUTCMonth() + 1)}${String(birthDate.getUTCFullYear()).slice(2)}${digits(5)}`
        : null,
      afm: chance(0.3) ? digits(9) : null,
      infectiousDiseases: chance(0.01) ? pick(["Ηπατίτιδα Β", "Ηπατίτιδα C", "HIV"]) : null,
      comments: chance(0.05) ? "Δοκιμαστικό σχόλιο." : null,
      flag,
      flagNote: flag === "NONE" ? null : "Δοκιμαστική σημείωση.",
      flagSetAt: flag === "NONE" ? null : registered,
      language: chance(0.04) ? "EN" : "EL",
      marketingConsent: chance(0.5),
      maritalStatusId: chance(0.7) ? pick(lists.MARITAL_STATUS) : null,
      referralSourceId: chance(0.6) ? pick(lists.REFERRAL_SOURCE) : null,
      taxOfficeId: chance(0.3) ? pick(lists.TAX_OFFICE) : null,
    },
    phones,
    emails,
    flagReasons,
  };
}

// How a name is often typed in Latin letters ("Ξανθοπούλου" -> "XANTHOPOULOU").
const LATIN: Record<string, string> = {
  α: "a", β: "v", γ: "g", δ: "d", ε: "e", ζ: "z", η: "i", θ: "th", ι: "i", κ: "k", λ: "l", μ: "m",
  ν: "n", ξ: "x", ο: "o", π: "p", ρ: "r", σ: "s", ς: "s", τ: "t", υ: "y", φ: "f", χ: "ch", ψ: "ps", ω: "o",
};
function greeklish(text: string) {
  return text
    .normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
    .replace(/ου/g, "ou").replace(/αυ/g, "av").replace(/ευ/g, "ev").replace(/μπ/g, "mp")
    .replace(/[α-ως]/g, (c) => LATIN[c] ?? c)
    .toUpperCase();
}

// Older patients who forgot they had been before: same person, new record,
// sometimes typed in Greeklish or with a different phone (SPEC §6b).
function duplicateOf(original: FakePatient, number: number): FakePatient {
  const copy = structuredClone(original);
  copy.data.number = number;
  copy.data.registeredAt = new Date(Date.UTC(2024, 0, 1) + rand() * 5e10);
  if (chance(0.3)) {
    copy.data.surname = greeklish(copy.data.surname);
    copy.data.firstName = greeklish(copy.data.firstName);
  }
  if (chance(0.5)) copy.phones = [{ number: `69${digits(8)}`, type: "MOBILE", isMain: true }];
  if (chance(0.5)) copy.data.amka = null;
  return copy;
}

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to add fake patients in production.");
  const replace = process.argv.includes("--replace");
  const existing = await db.patient.count();
  if (existing > 0 && !replace) {
    console.log(`There are already ${existing} patients. Run with --replace to start over with fake ones.`);
    return;
  }
  if (replace) {
    await db.patientFlagReason.deleteMany();
    await db.patient.deleteMany();
  }

  for (const company of await db.company.findMany()) {
    const count = COUNTS[company.code as keyof typeof COUNTS] ?? 0;
    const items = await db.listItem.findMany({ where: { companyId: company.id, isActive: true } });
    const lists: Record<string, string[]> = {};
    for (const i of items) (lists[i.kind] ??= []).push(i.id);

    const patients: FakePatient[] = [];
    for (let n = 1; n <= count; n++) {
      // About 1 in 150 is a forgotten earlier visit.
      patients.push(n > 100 && chance(1 / 150) ? duplicateOf(pick(patients.slice(0, n - 50)), n) : fakePatient(n, lists));
    }

    for (let i = 0; i < patients.length; i += BATCH) {
      const batch = patients.slice(i, i + BATCH);
      const created = await db.patient.createManyAndReturn({
        data: batch.map((p) => ({
          ...p.data,
          companyId: company.id,
          searchName: patientSearchName(p.data),
          sortName: patientSortName(p.data),
        })),
        select: { id: true },
      });
      await db.patientPhone.createMany({
        data: batch.flatMap((p, j) =>
          p.phones.map((ph, k) => ({ ...ph, patientId: created[j].id, companyId: company.id, digits: phoneDigits(ph.number), sortOrder: k })),
        ),
      });
      await db.patientEmail.createMany({
        data: batch.flatMap((p, j) =>
          p.emails.map((email, k) => ({ email: normalizeEmail(email), patientId: created[j].id, companyId: company.id, sortOrder: k })),
        ),
      });
      await db.patientFlagReason.createMany({
        data: batch.flatMap((p, j) =>
          p.flagReasons.map((listItemId) => ({ patientId: created[j].id, listItemId, companyId: company.id })),
        ),
      });
    }
    console.log(`${company.code}: ${patients.length} fake patients`);
  }
}

main().finally(() => db.$disconnect());
