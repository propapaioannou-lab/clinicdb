import { db } from "@/lib/db";
import { audit, type RequestContext } from "@/lib/audit";
import type { ContactLanguage, PatientFlag, PhoneType, Prisma, Sex } from "@/generated/prisma/client";
import { canArchivePatients, canEditPatients } from "@/lib/permissions";
import type { Actor } from "@/lib/users/manage";
import { normalizeEmail, patientSearchName, patientSortName, phoneDigits } from "./normalize";

// Every change to a patient's basic details goes through here: company and permission
// checks on the server, and an audit entry for each change (CLAUDE.md).

export type PatientInput = {
  surname: string;
  firstName: string;
  fatherName: string | null;
  birthDate: Date | null;
  sex: Sex | null;
  maritalStatusId: string | null;
  occupation: string | null;
  referralSourceId: string | null;
  referralNote: string | null;
  language: ContactLanguage;
  area: string | null;
  address: string | null;
  city: string | null;
  postcode: string | null;
  country: string | null;
  amka: string | null;
  afm: string | null;
  taxOfficeId: string | null;
  eprescriptionCity: string | null;
  eprescriptionPhone: string | null;
  marketingConsent: boolean;
  infectiousDiseases: string | null;
  treatingDoctorId: string | null;
  comments: string | null;
  ghlContactId: string | null;
  phones: { number: string; type: PhoneType; isMain: boolean }[];
  emails: string[];
};

export type FlagInput = { flag: PatientFlag; reasonIds: string[]; note: string | null };

export type PatientError =
  | "forbidden"
  | "not_found"
  | "surname_required"
  | "invalid_amka"
  | "invalid_afm"
  | "invalid_email"
  | "invalid_phone"
  | "invalid_birth_date"
  | "invalid_choice";

type Fail = { ok: false; error: PatientError };
const fail = (error: PatientError): Fail => ({ ok: false, error });

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Tidy up what was typed: trim, empty -> null, phones/emails normalised, one main phone.
export function cleanInput(input: PatientInput): PatientInput {
  const t = (s: string | null) => {
    const v = s?.trim();
    return v ? v : null;
  };
  const phones = input.phones.map((p) => ({ ...p, number: p.number.trim() })).filter((p) => p.number);
  if (phones.length && !phones.some((p) => p.isMain)) phones[0].isMain = true;
  let mainSeen = false;
  for (const p of phones) {
    if (p.isMain && mainSeen) p.isMain = false;
    if (p.isMain) mainSeen = true;
  }
  return {
    ...input,
    surname: input.surname.trim(),
    firstName: input.firstName.trim(),
    fatherName: t(input.fatherName),
    occupation: t(input.occupation),
    referralNote: t(input.referralNote),
    area: t(input.area),
    address: t(input.address),
    city: t(input.city),
    postcode: t(input.postcode),
    country: t(input.country),
    amka: t(input.amka)?.replace(/\s/g, "") ?? null,
    afm: t(input.afm)?.replace(/\s/g, "") ?? null,
    eprescriptionCity: t(input.eprescriptionCity),
    eprescriptionPhone: t(input.eprescriptionPhone),
    infectiousDiseases: t(input.infectiousDiseases),
    comments: t(input.comments),
    ghlContactId: t(input.ghlContactId),
    phones,
    emails: [...new Set(input.emails.map(normalizeEmail).filter(Boolean))],
  };
}

export function validateInput(input: PatientInput, now = new Date()): PatientError | null {
  if (!input.surname) return "surname_required";
  if (input.amka && !/^\d{11}$/.test(input.amka)) return "invalid_amka";
  if (input.afm && !/^\d{9}$/.test(input.afm)) return "invalid_afm";
  if (input.emails.some((e) => !EMAIL_RE.test(e))) return "invalid_email";
  if (input.phones.some((p) => phoneDigits(p.number).length < 5)) return "invalid_phone";
  if (input.birthDate && (input.birthDate > now || input.birthDate.getUTCFullYear() < 1900)) return "invalid_birth_date";
  return null;
}

// Chosen list items and the treating doctor must belong to this company.
async function checkChoices(companyId: string, input: PatientInput) {
  const listIds = [input.maritalStatusId, input.referralSourceId, input.taxOfficeId].filter((x): x is string => !!x);
  if (listIds.length) {
    const n = await db.listItem.count({ where: { id: { in: listIds }, companyId } });
    if (n !== new Set(listIds).size) return false;
  }
  if (input.treatingDoctorId) {
    const doc = await db.user.count({
      where: { id: input.treatingDoctorId, role: "SURGEON", memberships: { some: { companyId } } },
    });
    if (!doc) return false;
  }
  return true;
}

function scalarData(input: PatientInput) {
  const { phones, emails, ...rest } = input;
  return { ...rest, searchName: patientSearchName(input), sortName: patientSortName(input) };
}

// Next free number in this company. The lock makes two people saving at the same
// moment get different numbers.
async function nextNumber(tx: Prisma.TransactionClient, companyId: string) {
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${`patient-number:${companyId}`}))`;
  const max = await tx.patient.aggregate({ where: { companyId }, _max: { number: true } });
  return (max._max.number ?? 0) + 1;
}

// --- create ------------------------------------------------------------------------

export async function createPatient(
  actor: Actor,
  companyId: string,
  raw: PatientInput,
  ctx: RequestContext,
  opts: { notDuplicateOf?: string[] } = {},
): Promise<Fail | { ok: true; id: string; number: number }> {
  if (!canEditPatients(actor.level) || !actor.companyIds.includes(companyId)) return fail("forbidden");
  const input = cleanInput(raw);
  const invalid = validateInput(input);
  if (invalid) return fail(invalid);
  if (!(await checkChoices(companyId, input))) return fail("invalid_choice");

  const patient = await db.$transaction(async (tx) => {
    const number = await nextNumber(tx, companyId);
    return tx.patient.create({
      data: {
        ...scalarData(input),
        companyId,
        number,
        createdById: actor.id,
        phones: { create: input.phones.map((p, i) => ({ ...p, companyId, digits: phoneDigits(p.number), sortOrder: i })) },
        emails: { create: input.emails.map((email, i) => ({ email, companyId, sortOrder: i })) },
      },
    });
  });
  await audit(
    { action: "patient.created", actor, companyId, entityType: "Patient", entityId: patient.id, details: { number: patient.number } },
    ctx,
  );
  // "Create new anyway" after a duplicate warning: remember these are different people.
  const others = await db.patient.findMany({ where: { id: { in: opts.notDuplicateOf ?? [] }, companyId }, select: { id: true } });
  for (const o of others) await markNotDuplicate(actor, companyId, patient.id, o.id, ctx);
  return { ok: true, id: patient.id, number: patient.number };
}

// --- update ------------------------------------------------------------------------

async function loadEditable(actor: Actor, id: string) {
  if (!canEditPatients(actor.level)) return null;
  return db.patient.findFirst({
    where: { id, companyId: { in: actor.companyIds } },
    include: { phones: { orderBy: { sortOrder: "asc" } }, emails: { orderBy: { sortOrder: "asc" } } },
  });
}

type Json = Prisma.InputJsonValue | null;
const toJson = (v: unknown): Json => (v instanceof Date ? v.toISOString().slice(0, 10) : (v as Json) ?? null);

export async function updatePatient(
  actor: Actor,
  id: string,
  raw: PatientInput,
  ctx: RequestContext,
): Promise<Fail | { ok: true }> {
  const before = await loadEditable(actor, id);
  if (!before) return fail(canEditPatients(actor.level) ? "not_found" : "forbidden");
  const input = cleanInput(raw);
  const invalid = validateInput(input);
  if (invalid) return fail(invalid);
  if (!(await checkChoices(before.companyId, input))) return fail("invalid_choice");
  const companyId = before.companyId;

  await db.$transaction([
    db.patient.update({ where: { id }, data: scalarData(input) }),
    db.patientPhone.deleteMany({ where: { patientId: id } }),
    db.patientPhone.createMany({
      data: input.phones.map((p, i) => ({ ...p, patientId: id, companyId, digits: phoneDigits(p.number), sortOrder: i })),
    }),
    db.patientEmail.deleteMany({ where: { patientId: id } }),
    db.patientEmail.createMany({ data: input.emails.map((email, i) => ({ email, patientId: id, companyId, sortOrder: i })) }),
  ]);

  // Old and new value of every field that changed.
  const changes: Record<string, { from: Json; to: Json }> = {};
  const { phones, emails, ...scalars } = input;
  for (const [k, v] of Object.entries(scalars)) {
    const from = toJson(before[k as keyof typeof before]);
    const to = toJson(v);
    if (JSON.stringify(from) !== JSON.stringify(to)) changes[k] = { from, to };
  }
  const phoneList = (ps: { number: string; type: string; isMain: boolean }[]) =>
    ps.map((p) => `${p.number} (${p.type}${p.isMain ? ", main" : ""})`);
  if (JSON.stringify(phoneList(before.phones)) !== JSON.stringify(phoneList(phones))) {
    changes.phones = { from: phoneList(before.phones), to: phoneList(phones) };
  }
  const beforeEmails = before.emails.map((e) => e.email);
  if (JSON.stringify(beforeEmails) !== JSON.stringify(emails)) changes.emails = { from: beforeEmails, to: emails };

  if (Object.keys(changes).length) {
    await audit({ action: "patient.updated", actor, companyId, entityType: "Patient", entityId: id, details: changes }, ctx);
  }
  return { ok: true };
}

// --- flag ---------------------------------------------------------------------------

export async function setFlag(actor: Actor, id: string, input: FlagInput, ctx: RequestContext): Promise<Fail | { ok: true }> {
  const p = await loadEditable(actor, id);
  if (!p) return fail(canEditPatients(actor.level) ? "not_found" : "forbidden");
  const flag = input.flag;
  const reasonIds = flag === "NONE" ? [] : [...new Set(input.reasonIds)];
  if (reasonIds.length) {
    const n = await db.listItem.count({ where: { id: { in: reasonIds }, companyId: p.companyId, kind: "FLAG_REASON" } });
    if (n !== reasonIds.length) return fail("invalid_choice");
  }
  const note = flag === "NONE" ? null : input.note?.trim() || null;
  const now = new Date();
  await db.$transaction([
    db.patient.update({
      where: { id },
      data: { flag, flagNote: note, flagSetAt: flag === "NONE" ? null : now, flagSetById: flag === "NONE" ? null : actor.id },
    }),
    db.patientFlagReason.deleteMany({ where: { patientId: id } }),
    db.patientFlagReason.createMany({ data: reasonIds.map((listItemId) => ({ patientId: id, listItemId, companyId: p.companyId })) }),
  ]);
  await audit(
    {
      action: "patient.flag_changed",
      actor,
      companyId: p.companyId,
      entityType: "Patient",
      entityId: id,
      details: { from: p.flag, to: flag, reasonIds, note },
    },
    ctx,
  );
  return { ok: true };
}

// --- archive ------------------------------------------------------------------------

// Hidden from search and lists; everything kept; can be undone (SPEC §4). Owners only.
export async function setArchived(actor: Actor, id: string, archived: boolean, ctx: RequestContext): Promise<Fail | { ok: true }> {
  if (!canArchivePatients(actor.level)) return fail("forbidden");
  const p = await db.patient.findFirst({ where: { id, companyId: { in: actor.companyIds } } });
  if (!p) return fail("not_found");
  await db.patient.update({
    where: { id },
    data: archived ? { archivedAt: new Date(), archivedById: actor.id } : { archivedAt: null, archivedById: null },
  });
  await audit(
    { action: archived ? "patient.archived" : "patient.unarchived", actor, companyId: p.companyId, entityType: "Patient", entityId: id },
    ctx,
  );
  return { ok: true };
}

// --- duplicates ---------------------------------------------------------------------

export async function markNotDuplicate(actor: Actor, companyId: string, a: string, b: string, ctx: RequestContext) {
  const [patientAId, patientBId] = a < b ? [a, b] : [b, a];
  await db.patientNotDuplicate.upsert({
    where: { patientAId_patientBId: { patientAId, patientBId } },
    update: {},
    create: { companyId, patientAId, patientBId, createdById: actor.id },
  });
  await audit(
    { action: "patient.not_duplicate", actor, companyId, entityType: "Patient", entityId: a, details: { otherPatientId: b } },
    ctx,
  );
}
