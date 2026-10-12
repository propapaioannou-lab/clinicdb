import "server-only";
import { EventEmitter } from "node:events";
import { Client } from "pg";

// Live updates (Phase 6a-4): a change commits → PostgreSQL NOTIFY on "clinic_live" → this
// one listener per server process → every open screen (Server-Sent Events, /api/live).
// Nothing leaves our server. Events carry ids and a short name for the "ready" banner.

export const CHANNEL = "clinic_live";

export type LiveEvent = {
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
    // On a lost connection, drop it; the next subscriber reconnects.
    client.on("error", () => {
      hub.client = null;
    });
    client.on("end", () => {
      hub.client = null;
    });
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
