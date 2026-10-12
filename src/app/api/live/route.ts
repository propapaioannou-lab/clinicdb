import type { NextRequest } from "next/server";
import { getCurrentSession } from "@/lib/auth/current";
import { subscribe } from "@/lib/live/live";
import { canEditPatients } from "@/lib/permissions";
import { loadActor } from "@/lib/users/manage";

export const dynamic = "force-dynamic";

// Server-Sent Events: open screens get appointment changes of their companies at once
// (ready-in-room banner within ~1 s, calendars and home screens refresh themselves).
export async function GET(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const actor = await loadActor(session.user.id);
  if (!canEditPatients(actor.level)) return new Response("Forbidden", { status: 403 });
  const encoder = new TextEncoder();
  let stop = () => {};
  const stream = new ReadableStream({
    async start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          stop();
        }
      };
      const unsubscribe = await subscribe((e) => {
        if (actor.companyIds.includes(e.companyId)) send(`event: appointment\ndata: ${JSON.stringify(e)}\n\n`);
      });
      const ping = setInterval(() => send(": ping\n\n"), 25_000);
      stop = () => {
        clearInterval(ping);
        unsubscribe();
      };
      req.signal.addEventListener("abort", () => {
        stop();
        try {
          controller.close();
        } catch {}
      });
      send("retry: 3000\n\n");
    },
    cancel() {
      stop();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" } });
}
