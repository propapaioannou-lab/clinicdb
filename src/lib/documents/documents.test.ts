import { mkdtemp, readdir, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { companies, ctx, makeActor, makePatient } from "../../../test/factories";
import { listDocuments, readDocument, setDocumentDeleted, sniff, updateDocument, uploadDocuments } from "./documents";

let c: { surgery: string; spa: string };
const PDF = Buffer.from("%PDF-1.7\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
const meta = { type: "LAB_RESULT", documentDate: "30/09/2026", comment: "Γενική αίματος" };

beforeAll(async () => {
  process.env.DOCUMENTS_DIR = await mkdtemp(path.join(tmpdir(), "clinicdb-docs-"));
  c = await companies();
});

describe("file type check", () => {
  it("knows files by their content, not their name", () => {
    expect(sniff(PDF, "x.pdf")).toBe("application/pdf");
    expect(sniff(PNG, "photo.jpg")).toBe("image/png");
    expect(sniff(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]), "a.jpeg")).toBe("image/jpeg");
    expect(sniff(Buffer.from("PK\u0003\u0004....word/document.xml", "latin1"), "a.docx")).toContain("wordprocessingml");
  });
  it("refuses web pages, SVG, programs and disguised files", () => {
    expect(sniff(Buffer.from("<html><script>alert(1)</script>"), "a.pdf")).toBeNull();
    expect(sniff(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), "a.svg")).toBeNull();
    expect(sniff(Buffer.from("MZ\u0090\u0000"), "invoice.pdf")).toBeNull();
    expect(sniff(Buffer.from("PK\u0003\u0004 nothing office here", "latin1"), "a.docx")).toBeNull();
  });
});

describe("documents", () => {
  it("a secretary uploads two files: stored under random names with their fingerprint, logged", async () => {
    const p = await makePatient(c.surgery, { surname: "Εγγράφου" });
    const sec = await makeActor("USER", [c.surgery], "SECRETARY");
    const r = await uploadDocuments(sec, p.id, [{ name: "αίμα.pdf", bytes: PDF }, { name: "../../etc/passwd.png", bytes: PNG }], meta, ctx);
    if (!r.ok) throw new Error(r.error);
    const docs = await db.document.findMany({ where: { patientId: p.id }, orderBy: { createdAt: "asc" } });
    // A path-like file name is only a label; the file goes under a random key.
    expect(docs.map((d) => [d.name, d.mimeType, d.type])).toEqual([["αίμα", "application/pdf", "LAB_RESULT"], ["../../etc/passwd", "image/png", "LAB_RESULT"]]);
    for (const d of docs) {
      expect(d.storageKey).toMatch(/^[0-9a-f]{2}\/[0-9a-f-]{36}$/);
      const file = path.join(process.env.DOCUMENTS_DIR!, d.storageKey);
      expect(createHash("sha256").update(await readFile(file)).digest("hex")).toBe(d.sha256);
      expect((await stat(file)).mode & 0o077).toBe(0);
    }
    expect(await db.auditLog.count({ where: { action: "document.uploaded", entityId: p.id } })).toBe(2);
  });

  it("one bad file refuses the whole upload and nothing is stored", async () => {
    const p = await makePatient(c.surgery, { surname: "Κακού" });
    const sec = await makeActor("USER", [c.surgery], "SECRETARY");
    const before = (await readdir(process.env.DOCUMENTS_DIR!, { recursive: true })).length;
    expect(await uploadDocuments(sec, p.id, [{ name: "ok.pdf", bytes: PDF }, { name: "page.html", bytes: Buffer.from("<html>") }], meta, ctx)).toEqual({ ok: false, error: "bad_type", file: "page.html" });
    expect(await uploadDocuments(sec, p.id, [{ name: "big.pdf", bytes: Buffer.concat([PDF, Buffer.alloc(26 * 1024 * 1024)]) }], meta, ctx)).toEqual({ ok: false, error: "too_big", file: "big.pdf" });
    expect(await uploadDocuments(sec, p.id, [{ name: "ok.pdf", bytes: PDF }], { ...meta, documentDate: "31/02/2026" }, ctx)).toEqual({ ok: false, error: "invalid_value" });
    expect(await db.document.count({ where: { patientId: p.id } })).toBe(0);
    expect((await readdir(process.env.DOCUMENTS_DIR!, { recursive: true })).length).toBe(before);
  });

  it("refuses Guests, other companies and a visit of another patient", async () => {
    const p = await makePatient(c.surgery, { surname: "Ξένου" });
    const other = await makePatient(c.surgery, { surname: "Άλλου" });
    const v = await db.visit.create({ data: { companyId: c.surgery, patientId: other.id } });
    const one = [{ name: "a.pdf", bytes: PDF }];
    expect(await uploadDocuments(await makeActor("GUEST", [c.surgery]), p.id, one, meta, ctx)).toEqual({ ok: false, error: "forbidden" });
    expect(await uploadDocuments(await makeActor("USER", [c.spa], "SECRETARY"), p.id, one, meta, ctx)).toEqual({ ok: false, error: "not_found" });
    expect(await uploadDocuments(await makeActor("USER", [c.surgery], "SECRETARY"), p.id, one, { ...meta, visitId: v.id }, ctx)).toEqual({ ok: false, error: "invalid_value" });
  });

  it("reading is logged; Guests open clinical files but not consents", async () => {
    const p = await makePatient(c.surgery, { surname: "Ανάγνωσης" });
    const sec = await makeActor("USER", [c.surgery], "SECRETARY");
    const lab = await uploadDocuments(sec, p.id, [{ name: "lab.pdf", bytes: PDF }], meta, ctx);
    const consent = await uploadDocuments(sec, p.id, [{ name: "consent.pdf", bytes: PDF }], { ...meta, type: "GENERAL_CONSENT" }, ctx);
    if (!lab.ok || !consent.ok) throw new Error("upload");
    const guest = await makeActor("GUEST", [c.surgery]);
    expect((await readDocument(guest, lab.ids[0], false, ctx))?.bytes.equals(PDF)).toBe(true);
    expect(await readDocument(guest, consent.ids[0], false, ctx)).toBeNull();
    expect(await readDocument(await makeActor("USER", [c.spa], "SECRETARY"), lab.ids[0], false, ctx)).toBeNull();
    await readDocument(sec, consent.ids[0], true, ctx);
    expect(await db.auditLog.count({ where: { action: { in: ["document.viewed", "document.downloaded"] }, entityId: p.id } })).toBe(2);
    expect((await listDocuments(guest, p.id))?.map((d) => [d.type, d.canOpen])).toEqual(expect.arrayContaining([["LAB_RESULT", true], ["GENERAL_CONSENT", false]]));
  });

  it("editing changes the description only; delete hides it, only the Owner restores", async () => {
    const p = await makePatient(c.surgery, { surname: "Διαγραφής" });
    const sec = await makeActor("USER", [c.surgery], "SECRETARY");
    const owner = await makeActor("OWNER", [c.surgery], "SURGEON");
    const r = await uploadDocuments(sec, p.id, [{ name: "scan.pdf", bytes: PDF }], meta, ctx);
    if (!r.ok) throw new Error(r.error);
    const id = r.ids[0];
    expect(await updateDocument(sec, id, { ...meta, name: "Γενική αίματος Σεπτ.", type: "LAB_RESULT" }, ctx)).toEqual({ ok: true });
    expect((await db.auditLog.findFirstOrThrow({ where: { action: "document.updated", entityId: p.id } })).details).toMatchObject({ changed: ["name"] });
    expect(await setDocumentDeleted(sec, id, true, ctx)).toEqual({ ok: true });
    expect(await listDocuments(sec, p.id)).toEqual([]);
    expect(await readDocument(sec, id, false, ctx)).toBeNull();
    expect(await setDocumentDeleted(sec, id, false, ctx)).toEqual({ ok: false, error: "forbidden" });
    expect((await listDocuments(owner, p.id, true))?.[0]).toMatchObject({ deleted: true });
    expect(await setDocumentDeleted(owner, id, false, ctx)).toEqual({ ok: true });
    expect((await listDocuments(sec, p.id))?.length).toBe(1);
  });
});
