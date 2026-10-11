import { NextResponse, type NextRequest } from "next/server";
import { getCurrentSession, requestContext } from "@/lib/auth/current";
import { activeCompany } from "@/lib/company";
import { researchExport } from "@/lib/export/research";
import { loadActor } from "@/lib/users/manage";

// Research export of the company in the Ιατρείο | Spa switch: ?kind=patients | visits.
export async function GET(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  const actor = await loadActor(session.user.id);
  const kind = req.nextUrl.searchParams.get("kind") === "visits" ? "visits" : "patients";
  const company = await activeCompany(actor);
  const r = company ? await researchExport(actor, company.id, kind, await requestContext()) : null;
  if (!r) return new NextResponse("Not found", { status: 404 });
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Athens" }).format(new Date());
  return new NextResponse(r.csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="research-${kind}-${company!.code}-${day}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
