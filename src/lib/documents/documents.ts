import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { audit, type RequestContext } from "@/lib/audit";
import type { DocumentType } from "@/generated/prisma/client";
import { canArchivePatients, canEditPatients } from "@/lib/permissions";
import { parseDayMonthYear } from "@/lib/patients/normalize";
import type { Actor } from "@/lib/users/manage";

// Patients' documents (SPEC §4 Document, Phase 2 step 6, decided 11 Oct 2026).
// Files live in DOCUMENTS_DIR under a random storage key; the user's file name is kept
// only as data. The file is never changed after upload; deleting hides the record.

export const DOCUMENT_TYPES = [
  "GENERAL_CONSENT", "PROCEDURE_CONSENT", "LAB_RESULT", "IMAGING", "REFERRAL",
  "LETTER", "HISTORY", "SURGICAL_BRIEF", "PHOTO", "OTHER",
] as const satisfies readonly DocumentType[];

// Guests (research) see clinical files only: consents, letters, referrals and "other"
// may carry contact details or AMKA.
const GUEST_TYPES = new Set<DocumentType>(["LAB_RESULT", "IMAGING", "HISTORY", "SURGICAL_BRIEF", "PHOTO"]);
export const canOpenDocument = (actor: Pick<Actor, "level">, type: DocumentType) => actor.level !== "GUEST" || GUEST_TYPES.has(type);

export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_FILES = 20;

export type DocumentError = "forbidden" | "not_found" | "no_files" | "too_many" | "too_big" | "bad_type" | "invalid_value";
type Fail = { ok: false; error: DocumentError; file?: string };
const fail = (error: DocumentError, file?: string): Fail => ({ ok: false, error, ...(file && { file }) });

const dir = () => process.env.DOCUMENTS_DIR || "/data/documents";
const fullPath = (storageKey: string) => path.join(dir(), storageKey);

const starts = (b: Buffer, sig: number[], at = 0) => sig.every((x, i) => b[at + i] === x);
const ascii = (b: Buffer, s: string, at = 0) => b.subarray(at, at + s.length).toString("latin1") === s;
const ext = (name: string) => name.toLowerCase().split(".").pop() ?? "";

// What the file really is, from its first bytes (never from the name alone). Anything
// else (HTML, SVG, scripts, executables…) is refused.
export function sniff(bytes: Buffer, fileName: string): string | null {
  if (ascii(bytes, "%PDF-")) return "application/pdf";
  if (starts(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (starts(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (ascii(bytes, "RIFF") && ascii(bytes, "WEBP", 8)) return "image/webp";
  if (ascii(bytes, "GIF87a") || ascii(bytes, "GIF89a")) return "image/gif";
  if (ascii(bytes, "ftyp", 4) && ["heic", "heix", "hevc", "mif1", "msf1"].includes(bytes.subarray(8, 12).toString("latin1"))) return "image/heic";
  const e = ext(fileName);
  // Office files: ZIP (docx/xlsx) with the matching part inside, or the old OLE format.
  if (starts(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    const body = bytes.toString("latin1");
    if (e === "docx" && body.includes("word/")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (e === "xlsx" && body.includes("xl/")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    return null;
  }
  if (starts(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
    if (e === "doc") return "application/msword";
    if (e === "xls") return "application/vnd.ms-excel";
  }
  return null;
}

// Shown inside the app (PDF and images browsers can display); the rest is downloaded.
export const isInline = (mime: string) => mime === "application/pdf" || (mime.startsWith("image/") && mime !== "image/heic");
export const isImage = (mime: string) => mime.startsWith("image/") && mime !== "image/heic";

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export type DocumentMeta = { type: DocumentType; documentDate: Date; comment: string | null; visitId: string | null; name?: string };

// Type, date (dd/mm/yyyy as typed), comment, visit; name only when editing one document.
export function cleanMeta(raw: Record<string, unknown>): DocumentMeta | null {
  const type = (DOCUMENT_TYPES as readonly string[]).includes(raw.type as string) ? (raw.type as DocumentType) : "OTHER";
  const documentDate = parseDayMonthYear(clean(raw.documentDate, 10));
  if (!(documentDate instanceof Date) || documentDate.getUTCFullYear() < 1900 || documentDate > new Date(Date.now() + 864e5)) return null;
  const name = clean(raw.name, 200);
  return {
    type,
    documentDate,
    comment: clean(raw.comment, 2000) || null,
    visitId: clean(raw.visitId, 40) || null,
    ...(raw.name !== undefined && { name }),
  };
}

async function findPatient(actor: Actor, patientId: string) {
  return db.patient.findFirst({ where: { id: patientId, companyId: { in: actor.companyIds } }, select: { id: true, companyId: true } });
}
async function visitOk(patientId: string, visitId: string | null) {
  return !visitId || !!(await db.visit.findFirst({ where: { id: visitId, patientId }, select: { id: true } }));
}
async function findDocument(actor: Actor, id: string) {
  return db.document.findFirst({ where: { id, companyId: { in: actor.companyIds } } });
}

const baseName = (fileName: string) => fileName.replace(/\.[^.]+$/, "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, 200) || "Έγγραφο";

export async function uploadDocuments(
  actor: Actor,
  patientId: string,
  files: { name: string; bytes: Buffer }[],
  raw: Record<string, unknown>,
  ctx: RequestContext,
): Promise<Fail | { ok: true; ids: string[] }> {
  if (!canEditPatients(actor.level)) return fail("forbidden");
  const patient = await findPatient(actor, patientId);
  if (!patient) return fail("not_found");
  if (!files.length) return fail("no_files");
  if (files.length > MAX_FILES) return fail("too_many");
  const meta = cleanMeta(raw);
  if (!meta || !(await visitOk(patientId, meta.visitId))) return fail("invalid_value");
  // Check every file before storing any.
  const checked: { name: string; bytes: Buffer; mime: string }[] = [];
  for (const f of files) {
    if (f.bytes.length > MAX_FILE_BYTES) return fail("too_big", f.name);
    const mime = f.bytes.length ? sniff(f.bytes, f.name) : null;
    if (!mime) return fail("bad_type", f.name);
    checked.push({ ...f, mime });
  }
  const ids: string[] = [];
  for (const f of checked) {
    const key = randomUUID();
    const storageKey = `${key.slice(0, 2)}/${key}`;
    const target = fullPath(storageKey);
    await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
    await writeFile(`${target}.part`, f.bytes, { mode: 0o600 });
    await rename(`${target}.part`, target);
    try {
      const doc = await db.document.create({
        data: {
          companyId: patient.companyId,
          patientId,
          visitId: meta.visitId,
          type: meta.type,
          name: baseName(f.name),
          documentDate: meta.documentDate,
          comment: meta.comment,
          fileName: f.name.slice(0, 255),
          mimeType: f.mime,
          sizeBytes: f.bytes.length,
          sha256: createHash("sha256").update(f.bytes).digest("hex"),
          storageKey,
          uploadedById: actor.id,
        },
      });
      ids.push(doc.id);
      await audit(
        { action: "document.uploaded", actor, companyId: patient.companyId, entityType: "Patient", entityId: patientId, details: { documentId: doc.id, type: meta.type, sizeBytes: f.bytes.length } },
        ctx,
      );
    } catch (e) {
      await rm(target, { force: true });
      throw e;
    }
  }
  return { ok: true, ids };
}

// The Έγγραφα tab. Deleted ones only for the Owner (to restore).
export async function listDocuments(actor: Actor, patientId: string, includeDeleted = false) {
  const patient = await findPatient(actor, patientId);
  if (!patient) return null;
  const rows = await db.document.findMany({
    where: { patientId, companyId: patient.companyId, ...(!(includeDeleted && canArchivePatients(actor.level)) && { deletedAt: null }) },
    orderBy: [{ documentDate: "desc" }, { createdAt: "desc" }],
    include: { visit: { select: { id: true, startedAt: true, type: { select: { label: true } } } } },
  });
  return rows.map((d) => ({
    id: d.id,
    type: d.type,
    name: d.name,
    documentDate: d.documentDate,
    comment: d.comment,
    fileName: d.fileName,
    mimeType: d.mimeType,
    sizeBytes: d.sizeBytes,
    createdAt: d.createdAt,
    deleted: d.deletedAt !== null,
    canOpen: canOpenDocument(actor, d.type),
    visit: d.visit ? { id: d.visit.id, startedAt: d.visit.startedAt, type: d.visit.type?.label ?? null } : null,
  }));
}

export const countDocuments = (patientId: string) => db.document.count({ where: { patientId, deletedAt: null } });

// The file, for viewing or download. Every read is logged.
export async function readDocument(actor: Actor, id: string, download: boolean, ctx: RequestContext) {
  const doc = await findDocument(actor, id);
  if (!doc || (doc.deletedAt && !canArchivePatients(actor.level)) || !canOpenDocument(actor, doc.type)) return null;
  const bytes = await readFile(fullPath(doc.storageKey));
  await audit(
    { action: download ? "document.downloaded" : "document.viewed", actor, companyId: doc.companyId, entityType: "Patient", entityId: doc.patientId, details: { documentId: doc.id } },
    ctx,
  );
  return { doc, bytes };
}

// Only the description changes; the file never does.
export async function updateDocument(actor: Actor, id: string, raw: Record<string, unknown>, ctx: RequestContext): Promise<Fail | { ok: true }> {
  if (!canEditPatients(actor.level)) return fail("forbidden");
  const doc = await findDocument(actor, id);
  if (!doc || doc.deletedAt) return fail("not_found");
  const meta = cleanMeta(raw);
  if (!meta || !meta.name || !(await visitOk(doc.patientId, meta.visitId))) return fail("invalid_value");
  const data = { name: meta.name, type: meta.type, documentDate: meta.documentDate, comment: meta.comment, visitId: meta.visitId };
  const plain = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v ?? ""));
  const changed = (Object.keys(data) as (keyof typeof data)[]).filter((k) => plain(doc[k]) !== plain(data[k]));
  if (!changed.length) return { ok: true };
  await db.document.update({ where: { id }, data });
  await audit({ action: "document.updated", actor, companyId: doc.companyId, entityType: "Patient", entityId: doc.patientId, details: { documentId: id, changed } }, ctx);
  return { ok: true };
}

export async function setDocumentDeleted(actor: Actor, id: string, deleted: boolean, ctx: RequestContext): Promise<Fail | { ok: true }> {
  // Anyone who may edit can delete (a wrong upload); only the Owner restores.
  if (deleted ? !canEditPatients(actor.level) : !canArchivePatients(actor.level)) return fail("forbidden");
  const doc = await findDocument(actor, id);
  if (!doc || (doc.deletedAt !== null) === deleted) return fail("not_found");
  await db.document.update({ where: { id }, data: deleted ? { deletedAt: new Date(), deletedById: actor.id } : { deletedAt: null, deletedById: null } });
  await audit(
    { action: deleted ? "document.deleted" : "document.restored", actor, companyId: doc.companyId, entityType: "Patient", entityId: doc.patientId, details: { documentId: id } },
    ctx,
  );
  return { ok: true };
}
