"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ContactLanguage, PatientFlag, PhoneType, Sex } from "@/generated/prisma/client";
import { requestContext, requireSession } from "@/lib/auth/current";
import { activeCompany } from "@/lib/company";
import { db } from "@/lib/db";
import { changedIdentity, findDuplicates, type DuplicateCandidate } from "@/lib/patients/duplicates";
import {
  cleanInput,
  createPatient,
  markNotDuplicate,
  setArchived,
  setFlag,
  updatePatient,
  validateInput,
  type PatientError,
  type PatientInput,
} from "@/lib/patients/manage";
import { parseDayMonthYear } from "@/lib/patients/normalize";
import { loadActor } from "@/lib/users/manage";

export type PatientFormState = {
  error?: PatientError;
  duplicates?: DuplicateCandidate[];
  saved?: boolean;
};

const SEX: Sex[] = ["FEMALE", "MALE", "TRANS_MAN", "TRANS_WOMAN", "NON_BINARY"];
const PHONE_TYPES: PhoneType[] = ["MOBILE", "HOME", "WORK", "OTHER"];

function str(fd: FormData, k: string) {
  return String(fd.get(k) ?? "");
}
function opt(fd: FormData, k: string) {
  const v = str(fd, k).trim();
  return v ? v : null;
}
async function readInput(fd: FormData): Promise<PatientInput | "invalid_birth_date"> {
  const birthDate = parseDayMonthYear(opt(fd, "birthDate"));
  if (birthDate === "invalid") return "invalid_birth_date";
  const numbers = fd.getAll("phoneNumber").map(String);
  const types = fd.getAll("phoneType").map(String);
  const main = Number(fd.get("phoneMain") ?? 0);
  const sex = str(fd, "sex") as Sex;
  return {
    surname: str(fd, "surname"),
    firstName: str(fd, "firstName"),
    fatherName: opt(fd, "fatherName"),
    birthDate,
    sex: SEX.includes(sex) ? sex : null,
    maritalStatusId: opt(fd, "maritalStatusId"),
    occupation: opt(fd, "occupation"),
    referralSourceId: opt(fd, "referralSourceId"),
    referralNote: opt(fd, "referralNote"),
    language: (str(fd, "language") === "EN" ? "EN" : "EL") as ContactLanguage,
    area: opt(fd, "area"),
    address: opt(fd, "address"),
    city: opt(fd, "city"),
    postcode: opt(fd, "postcode"),
    country: opt(fd, "country"),
    amka: opt(fd, "amka"),
    afm: opt(fd, "afm"),
    taxOfficeId: opt(fd, "taxOfficeId"),
    eprescriptionCity: opt(fd, "eprescriptionCity"),
    eprescriptionPhone: opt(fd, "eprescriptionPhone"),
    treatingDoctorId: opt(fd, "treatingDoctorId"),
    ghlContactId: opt(fd, "ghlContactId"),
    phones: numbers.map((number, i) => ({
      number,
      type: PHONE_TYPES.includes(types[i] as PhoneType) ? (types[i] as PhoneType) : "MOBILE",
      isMain: i === main,
    })),
    emails: fd.getAll("email").map(String),
  };
}

async function actorNow() {
  const session = await requireSession();
  return loadActor(session.user.id);
}

// New patient. First submit: duplicate check; if there are look-alikes, they are shown
// side by side. "Create new anyway" resubmits with confirmed=1.
export async function createPatientAction(fd: FormData): Promise<PatientFormState> {
  const actor = await actorNow();
  const company = await activeCompany(actor);
  if (!company) return { error: "forbidden" };
  const raw = await readInput(fd);
  if (raw === "invalid_birth_date") return { error: raw };
  const input = cleanInput(raw);
  const invalid = validateInput(input);
  if (invalid) return { error: invalid };

  const confirmed = fd.get("confirmed") === "1";
  if (!confirmed) {
    const duplicates = await findDuplicates(company.id, input);
    if (duplicates.length) return { duplicates };
  }
  const notDuplicateOf = fd.getAll("notDuplicateOf").map(String);
  const r = await createPatient(actor, company.id, input, await requestContext(), { notDuplicateOf });
  if (!r.ok) return { error: r.error };
  revalidatePath("/patients");
  redirect(`/patients/${r.id}`);
}

// "Same person": update the existing record with the fields chosen on the comparison
// screen; phones and emails that were ticked are added.
export async function mergeIntoExistingAction(existingId: string, fd: FormData): Promise<PatientFormState> {
  const actor = await actorNow();
  const raw = await readInput(fd);
  if (raw === "invalid_birth_date") return { error: raw };
  const incoming = cleanInput(raw);
  const existing = await db.patient.findFirst({
    where: { id: existingId, companyId: { in: actor.companyIds } },
    include: { phones: { orderBy: { sortOrder: "asc" } }, emails: { orderBy: { sortOrder: "asc" } } },
  });
  if (!existing) return { error: "not_found" };
  const take = new Set(fd.getAll("takeNew").map(String));
  const merged: PatientInput = {
    surname: existing.surname,
    firstName: existing.firstName,
    fatherName: existing.fatherName,
    birthDate: existing.birthDate,
    sex: existing.sex,
    maritalStatusId: existing.maritalStatusId,
    occupation: existing.occupation,
    referralSourceId: existing.referralSourceId,
    referralNote: existing.referralNote,
    language: existing.language,
    area: existing.area,
    address: existing.address,
    city: existing.city,
    postcode: existing.postcode,
    country: existing.country,
    amka: existing.amka,
    afm: existing.afm,
    taxOfficeId: existing.taxOfficeId,
    eprescriptionCity: existing.eprescriptionCity,
    eprescriptionPhone: existing.eprescriptionPhone,
    treatingDoctorId: existing.treatingDoctorId,
    ghlContactId: existing.ghlContactId,
    phones: existing.phones.map(({ number, type, isMain }) => ({ number, type, isMain })),
    emails: existing.emails.map((e) => e.email),
  };
  const scalars = merged as unknown as Record<string, unknown>;
  const fromNew = incoming as unknown as Record<string, unknown>;
  for (const [k, v] of Object.entries(fromNew)) {
    if (k === "phones" || k === "emails" || v === null || v === "" || v === false) continue;
    // Chosen on screen, or simply missing in the existing record.
    const empty = scalars[k] === null || scalars[k] === "";
    if (take.has(k) || empty) scalars[k] = v;
  }
  const addPhones = new Set(fd.getAll("addPhone").map(String));
  for (const p of incoming.phones) if (addPhones.has(p.number)) merged.phones.push({ ...p, isMain: false });
  const addEmails = new Set(fd.getAll("addEmail").map(String));
  for (const e of incoming.emails) if (addEmails.has(e) && !merged.emails.includes(e)) merged.emails.push(e);

  const r = await updatePatient(actor, existingId, merged, await requestContext());
  if (!r.ok) return { error: r.error };
  revalidatePath(`/patients/${existingId}`);
  redirect(`/patients/${existingId}`);
}

// Editing from the patient card. If contact details now match someone else, warn first;
// "save anyway" remembers those pairs as different people.
export async function updatePatientAction(id: string, fd: FormData): Promise<PatientFormState> {
  const actor = await actorNow();
  const raw = await readInput(fd);
  if (raw === "invalid_birth_date") return { error: raw };
  const input = cleanInput(raw);
  const invalid = validateInput(input);
  if (invalid) return { error: invalid };
  const current = await db.patient.findFirst({
    where: { id, companyId: { in: actor.companyIds } },
    select: {
      companyId: true, surname: true, firstName: true, birthDate: true, amka: true,
      phones: { select: { digits: true } }, emails: { select: { email: true } },
    },
  });
  if (!current) return { error: "not_found" };
  const ctx = await requestContext();

  // Only what changed is checked: editing the city never stops the save.
  const changed = changedIdentity(current, input);
  if (changed && fd.get("confirmed") !== "1") {
    const duplicates = await findDuplicates(current.companyId, changed, id);
    if (duplicates.length) return { duplicates };
  }
  const r = await updatePatient(actor, id, input, ctx);
  if (!r.ok) return { error: r.error };
  for (const other of fd.getAll("notDuplicateOf").map(String)) {
    if (other !== id) await markNotDuplicate(actor, current.companyId, id, other, ctx);
  }
  revalidatePath(`/patients/${id}`);
  return { saved: true };
}

export async function setFlagAction(id: string, fd: FormData): Promise<PatientFormState> {
  const actor = await actorNow();
  const flag = (["NONE", "YELLOW", "RED"].includes(str(fd, "flag")) ? str(fd, "flag") : "NONE") as PatientFlag;
  const r = await setFlag(actor, id, { flag, reasonIds: fd.getAll("reason").map(String), note: opt(fd, "flagNote") }, await requestContext());
  if (!r.ok) return { error: r.error };
  revalidatePath(`/patients/${id}`);
  return { saved: true };
}

export async function setArchivedAction(id: string, archived: boolean) {
  const actor = await actorNow();
  await setArchived(actor, id, archived, await requestContext());
  revalidatePath(`/patients/${id}`);
  revalidatePath("/patients");
}
