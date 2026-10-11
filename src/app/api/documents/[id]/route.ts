import { NextResponse, type NextRequest } from "next/server";
import { getCurrentSession, requestContext } from "@/lib/auth/current";
import { isInline, readDocument } from "@/lib/documents/documents";
import { loadActor } from "@/lib/users/manage";

// One document's file. PDFs and images open in the browser; everything else (and
// ?download=1) is downloaded. Every read is logged in readDocument.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  const actor = await loadActor(session.user.id);
  const { id } = await params;
  const download = req.nextUrl.searchParams.get("download") === "1";
  const r = await readDocument(actor, id, download, await requestContext());
  if (!r) return new NextResponse("Not found", { status: 404 });
  const inline = !download && isInline(r.doc.mimeType);
  const headers: Record<string, string> = {
    "Content-Type": r.doc.mimeType,
    "Content-Length": String(r.bytes.length),
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(r.doc.fileName)}`,
    // Medical data: never cached, never sniffed into something else.
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    // Images can't run anything; PDFs need the browser's viewer, which a sandbox blocks.
    "Content-Security-Policy": r.doc.mimeType === "application/pdf" ? "frame-ancestors 'self'" : "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox; frame-ancestors 'self'",
  };
  return new NextResponse(new Uint8Array(r.bytes), { headers });
}
