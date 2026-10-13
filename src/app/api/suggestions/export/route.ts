import { NextResponse, type NextRequest } from "next/server";
import { getCurrentSession, requestContext } from "@/lib/auth/current";
import { suggestionsMarkdown } from "@/lib/demo-suggestions";
import { loadActor } from "@/lib/users/manage";

// Online demo: the «💬 Πρόταση» comments as one Markdown file (?show=open | done | all).
export async function GET(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  const actor = await loadActor(session.user.id);
  const q = req.nextUrl.searchParams.get("show");
  const show = q === "open" || q === "done" ? q : "all";
  const md = await suggestionsMarkdown(actor, show, await requestContext());
  if (md === null) return new NextResponse("Not found", { status: 404 });
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Athens" }).format(new Date());
  return new NextResponse(md, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="protaseis-${day}.md"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
