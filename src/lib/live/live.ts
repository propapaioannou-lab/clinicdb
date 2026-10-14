import "server-only";
import { EventEmitter } from "node:events";
import { Client } from "pg";

// Live updates (Phase 6a-4): a change commits → PostgreSQL NOTIFY on "clinic_live" → this
// one listener per server process → every open screen (Server-Sent Events, /api/live).
// Nothing leaves our server. Events carry ids and a short name for the "ready" banner.

export const CHANNEL = "clinic_live";

export type LiveEvent = LiveAppointmentEvent | LiveChatEvent | LiveBubbleEvent;
// Patients waiting on the calendar for a time changed (calendar v3).
export type LiveBubbleEvent = { type: "bubble"; companyId: string; action: string; bubbleId: string; at: string };
// A new staff-chat message (6a-10).
export type LiveChatEvent = { type: "chat"; companyId: string; message: { id: string; senderId: string; senderName: string; senderRole: string; text: string; at: string } };
export type LiveAppointmentEvent = {
  type: "appointment";
  companyId: string;
  appointmentId: string;
  action: string;
  status: string;
  room: string | null;
  resourceId: string;
  patientId: string | null;
  patientShort: string | null;
  byName: string | null;
  at: string;
};

type Hub = { emitter: EventEmitter; client: Client | null; connecting: Promise<void> | null };
const g = globalThis as unknown as { liveHub?: Hub };
const hub: Hub = g.liveHub ?? { emitter: new EventEmitter().setMaxListeners(500), client: null, connecting: null };
g.liveHub = hub;

async function connect() {
  if (hub.client || hub.connecting) return hub.connecting ?? undefined;
  hub.connecting = (async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    client.on("notification", (msg) => {
      if (msg.channel !== CHANNEL || !msg.payload) return;
      try {
        hub.emitter.emit("event", JSON.parse(msg.payload) as LiveEvent);
      } catch {}
    });
    // On a lost connection (database restart; the demo's database sleeps when idle), drop it
    // and reconnect while screens are still listening; otherwise the next subscriber does.
    const lost = () => {
      if (hub.client !== client) return;
      hub.client = null;
      setTimeout(() => {
        if (hub.emitter.listenerCount("event") > 0) connect().catch(() => {});
      }, 3000);
    };
    client.on("error", lost);
    client.on("end", lost);
    await client.connect();
    await client.query(`LISTEN ${CHANNEL}`);
    hub.client = client;
  })().finally(() => {
    hub.connecting = null;
  });
  return hub.connecting;
}

export async function subscribe(fn: (e: LiveEvent) => void): Promise<() => void> {
  await connect();
  hub.emitter.on("event", fn);
  return () => {
    hub.emitter.off("event", fn);
  };
}
