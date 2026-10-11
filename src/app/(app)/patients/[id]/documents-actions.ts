"use server";

import { revalidatePath } from "next/cache";
import { requestContext, requireSession } from "@/lib/auth/current";
import { setDocumentDeleted, updateDocument, uploadDocuments, type DocumentError } from "@/lib/documents/documents";
import { loadActor } from "@/lib/users/manage";

export type DocumentActionState = { error?: DocumentError; file?: string; saved?: number };

async function actorNow() {
  const session = await requireSession();
  return loadActor(session.user.id);
}

const fields = (fd: FormData) => ({
  type: fd.get("type"),
  documentDate: fd.get("documentDate"),
  comment: fd.get("comment"),
  visitId: fd.get("visitId"),
  ...(fd.has("name") && { name: fd.get("name") }),
});

export async function uploadDocumentsAction(patientId: string, fd: FormData): Promise<DocumentActionState> {
  const actor = await actorNow();
  const files = await Promise.all(
    fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0).map(async (f) => ({ name: f.name, bytes: Buffer.from(await f.arrayBuffer()) })),
  );
  const r = await uploadDocuments(actor, patientId, files, fields(fd), await requestContext());
  if (!r.ok) return { error: r.error, file: r.file };
  revalidatePath(`/patients/${patientId}`);
  return { saved: r.ids.length };
}

export async function updateDocumentAction(patientId: string, documentId: string, fd: FormData): Promise<DocumentActionState> {
  const actor = await actorNow();
  const r = await updateDocument(actor, documentId, fields(fd), await requestContext());
  if (!r.ok) return { error: r.error };
  revalidatePath(`/patients/${patientId}`);
  return { saved: 1 };
}

export async function setDocumentDeletedAction(patientId: string, documentId: string, deleted: boolean): Promise<DocumentActionState> {
  const actor = await actorNow();
  const r = await setDocumentDeleted(actor, documentId, deleted, await requestContext());
  if (!r.ok) return { error: r.error };
  revalidatePath(`/patients/${patientId}`);
  return {};
}
